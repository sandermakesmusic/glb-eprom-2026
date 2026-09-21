const canvas = document.getElementById("renderCanvas");

const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true
});

const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color4(0.005, 0.005, 0.005, 1);

// ============================================================
// VARIABLES
// ============================================================

const planeSize = 5;

// Diffraction
const grooveDensity = 1200.0;       // grooves / mm
const diffractionStrength = 3.0;
const orderCount = 8;

// Orientation field
const orientationScale = 1.4;       // size of orientation patches
const orientationVariation = 2.8;   // radians
const orientationDetail = 0.45;     // secondary variation

// Highlight
const highlightStrength = 0.3;
const highlightWidth = 2.0;

// Lights
const lightCount = 3;
const lightSpacing = 3.0;
const lightHeight = 5.0;
const lightIntensity = 20.0;

// Animation
const lightMotion = 0.5;


// ============================================================
// CAMERA
// ============================================================

const camera = new BABYLON.ArcRotateCamera(
    "camera",
    -Math.PI / 2.4,
    Math.PI / 2.7,
    7,
    BABYLON.Vector3.Zero(),
    scene
);

camera.attachControl(canvas, true);
camera.minZ = 0.1;
camera.wheelPrecision = 50;


// ============================================================
// SHADER
// ============================================================

BABYLON.Effect.ShadersStore["diffractionVertexShader"] = `

precision highp float;

attribute vec3 position;
attribute vec3 normal;

uniform mat4 world;
uniform mat4 worldViewProjection;

varying vec3 vPosition;
varying vec3 vNormal;

void main()
{
    vec4 worldPosition = world * vec4(position, 1.0);

    vPosition = worldPosition.xyz;
    vNormal = normalize(mat3(world) * normal);

    gl_Position = worldViewProjection * vec4(position, 1.0);
}

`;


BABYLON.Effect.ShadersStore["diffractionFragmentShader"] = `

precision highp float;

varying vec3 vPosition;
varying vec3 vNormal;

uniform vec3 cameraPosition;

uniform vec3 lightPositions[27];
uniform float lightIntensity;

uniform float grooveDensity;
uniform float diffractionStrength;

uniform float orientationScale;
uniform float orientationVariation;
uniform float orientationDetail;

uniform float highlightStrength;
uniform float highlightWidth;


// ------------------------------------------------------------
// HASH / NOISE
// ------------------------------------------------------------

float hash21(vec2 p)
{
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);

    return fract(p.x * p.y);
}


float valueNoise(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);

    f = f * f * (3.0 - 2.0 * f);

    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));

    return mix(
        mix(a, b, f.x),
        mix(c, d, f.x),
        f.y
    );
}


// ------------------------------------------------------------
// SMOOTH ORIENTATION FIELD
// ------------------------------------------------------------

float orientationNoise(vec2 p)
{
    float n1 = valueNoise(p);
    float n2 = valueNoise(p * 2.17 + 17.3);
    float n3 = valueNoise(p * 4.31 - 9.7);

    return
        n1 * 0.65 +
        n2 * 0.25 +
        n3 * 0.10;
}


float getOrientation(vec2 p)
{
    vec2 q = p * orientationScale;

    float n = orientationNoise(q);

    // Center around zero.
    n = n * 2.0 - 1.0;

    // A second, larger-scale variation keeps the field
    // from looking like simple repeating bands.
    float detail = valueNoise(q * 0.55 + 31.7);
    detail = detail * 2.0 - 1.0;

    return
        n * orientationVariation +
        detail * orientationDetail;
}


// ------------------------------------------------------------
// RAINBOW MAP
// GPU Gems-style three bump functions.
// ------------------------------------------------------------

vec3 blend3(vec3 x)
{
    vec3 y = 1.0 - x * x;
    return max(y, vec3(0.0));
}


vec3 rainbow(float wavelength)
{
    // wavelength in microns

    float y = wavelength;

    // Map visible range approximately 0.5 - 1.0
    // into the GPU Gems rainbow domain.
    float t = (y - 0.5) / 0.5;

    float r = blend3(
        vec3(4.0 * (t - 0.75))
    ).x;

    float g = blend3(
        vec3(4.0 * (t - 0.50))
    ).x;

    float b = blend3(
        vec3(4.0 * (t - 0.25))
    ).x;

    return vec3(r, g, b);
}


// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------

void main()
{
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vPosition);

    // --------------------------------------------------------
    // VARYING GRATING ORIENTATION
    //
    // T is the local direction of the grating bands.
    // B is perpendicular to it in the surface plane.
    // --------------------------------------------------------

    float angle = getOrientation(vPosition.xy);

    vec3 T = normalize(vec3(
        cos(angle),
        sin(angle),
        0.0
    ));

    vec3 B = normalize(cross(N, T));


    // --------------------------------------------------------
    // GROOVE SPACING
    //
    // grooveDensity = grooves / mm
    // convert to microns.
    // --------------------------------------------------------

    float d = 1000.0 / grooveDensity;


    vec3 diffractionColor = vec3(0.0);
    vec3 highlightColor = vec3(0.0);


    // --------------------------------------------------------
    // MULTIPLE WHITE LIGHTS
    // --------------------------------------------------------

    for (int i = 0; i < 27; i++)
    {
        vec3 L = normalize(lightPositions[i] - vPosition);

        vec3 H = L + V;

        float hLength = length(H);

        if (hLength > 0.0001)
        {
            H /= hLength;

            // GPU Gems uses the unnormalized halfway vector.
            // Recreate that quantity.
            vec3 Hraw = L + V;

            float u = dot(T, Hraw) * d;

            float w = dot(N, Hraw);

            // ------------------------------------------------
            // ANISOTROPIC WHITE HIGHLIGHT
            // ------------------------------------------------

            float safeW = max(abs(w), 0.001);

            float e = highlightWidth * u / safeW;

            float highlight = exp(-e * e);

            highlightColor +=
                vec3(1.0) *
                highlight *
                highlightStrength;


            // ------------------------------------------------
            // DIFFRACTION
            // ------------------------------------------------

            u = abs(u);

            vec3 spectral = vec3(0.0);

            for (int n = 1; n <= 8; n++)
            {
                float wavelength = u / float(n);

                // Visible range.
                if (
                    wavelength >= 0.50 &&
                    wavelength <= 1.00
                )
                {
                    spectral += rainbow(wavelength);
                }
            }

            diffractionColor += spectral;
        }
    }


    // --------------------------------------------------------
    // NORMALIZE LIGHT CONTRIBUTION
    // --------------------------------------------------------

    diffractionColor /= 27.0;
    highlightColor /= 27.0;


    // --------------------------------------------------------
    // GRAZING-ANGLE FRESNEL
    // --------------------------------------------------------

    float fresnel =
        pow(
            1.0 - max(dot(N, V), 0.0),
            3.0
        );


    diffractionColor *=
        diffractionStrength *
        (0.35 + fresnel * 1.5);

    highlightColor *=
        (0.5 + fresnel);


    vec3 finalColor =
        diffractionColor +
        highlightColor;


    // Light intensity
    finalColor *= lightIntensity;


    // --------------------------------------------------------
    // SOFT TONEMAP
    // --------------------------------------------------------

    finalColor =
        finalColor /
        (vec3(1.0) + finalColor);

    finalColor =
        pow(finalColor, vec3(1.0 / 2.2));


    gl_FragColor =
        vec4(finalColor, 1.0);
}

`;


// ============================================================
// MATERIAL
// ============================================================

const material = new BABYLON.ShaderMaterial(
    "diffractionMaterial",
    scene,
    {
        vertex: "diffraction",
        fragment: "diffraction"
    },
    {
        attributes: [
            "position",
            "normal"
        ],
        uniforms: [
            "world",
            "worldViewProjection",
            "cameraPosition",

            "lightPositions",
            "lightIntensity",

            "grooveDensity",
            "diffractionStrength",

            "orientationScale",
            "orientationVariation",
            "orientationDetail",

            "highlightStrength",
            "highlightWidth"
        ]
    }
);


// ============================================================
// PLANE
// ============================================================

const plane = BABYLON.MeshBuilder.CreatePlane(
    "diffractionSurface",
    {
        size: planeSize,
        sideOrientation: BABYLON.Mesh.DOUBLESIDE
    },
    scene
);

plane.rotation.x = Math.PI / 2;
plane.material = material;


// ============================================================
// LIGHT POSITIONS
// ============================================================

const lightPositions = [];

for (let x = -1; x <= 1; x++)
{
    for (let y = -1; y <= 1; y++)
    {
        for (let z = -1; z <= 1; z++)
        {
            lightPositions.push(
                new BABYLON.Vector3(
                    x * lightSpacing,
                    y * lightSpacing,
                    lightHeight + z * lightSpacing
                )
            );
        }
    }
}


// ============================================================
// SEND INITIAL LIGHT POSITIONS
// ============================================================

material.setArray3(
    "lightPositions",
    lightPositions.flatMap(p => [
        p.x,
        p.y,
        p.z
    ])
);

material.setFloat("lightIntensity", lightIntensity);

material.setFloat("grooveDensity", grooveDensity);
material.setFloat("diffractionStrength", diffractionStrength);

material.setFloat("orientationScale", orientationScale);
material.setFloat("orientationVariation", orientationVariation);
material.setFloat("orientationDetail", orientationDetail);

material.setFloat("highlightStrength", highlightStrength);
material.setFloat("highlightWidth", highlightWidth);


// ============================================================
// ANIMATION
// ============================================================

let time = 0;

scene.onBeforeRenderObservable.add(() =>
{
    time += engine.getDeltaTime() * 0.001;

    for (let i = 0; i < lightPositions.length; i++)
    {
        const base = lightPositions[i];

        const phase = i * 0.37;

        const x =
            base.x +
            Math.sin(time * lightMotion + phase) * 0.5;

        const y =
            base.y +
            Math.cos(time * lightMotion * 0.8 + phase) * 0.5;

        const z =
            base.z +
            Math.sin(time * lightMotion * 0.6 + phase) * 0.3;

        lightPositions[i].set(
            x,
            y,
            z
        );
    }

    material.setArray3(
        "lightPositions",
        lightPositions.flatMap(p => [
            p.x,
            p.y,
            p.z
        ])
    );
});


// ============================================================
// RESIZE
// ============================================================

window.addEventListener("resize", () =>
{
    engine.resize();
});


// ============================================================
// RENDER
// ============================================================

engine.runRenderLoop(() =>
{
    scene.render();
});