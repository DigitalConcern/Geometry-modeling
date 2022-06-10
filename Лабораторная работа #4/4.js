// 4.js

"use strict";

// Vertex shader program
const VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' +
  'attribute vec4 a_normal;\n' +
  'uniform mat4 u_mvpMatrix;\n' +
  'uniform float u_pointSize;\n' +
  'uniform vec4 u_color;\n' +
  'varying vec4 v_color;\n' +
  'varying vec4 v_normal;\n' +
  'varying vec4 v_position;\n' +
  'void main() {\n' +
  '  gl_Position = u_mvpMatrix * a_Position;\n' +
  '  v_color = u_color;\n' +
  '  gl_PointSize = u_pointSize;\n' +
  '  v_normal = a_normal;\n' +
  '  v_position = a_Position;\n' +
'}\n';

// Fragment shader program
const FSHADER_SOURCE =
  'precision mediump float;\n' +
  'varying vec4 v_color;\n' +
  'varying vec4 v_normal;\n' +
  'varying vec4 v_position;\n' +
  'uniform bool u_drawPolygon;\n' +
  'uniform vec3 u_LightColor;\n' +     // Light color
  'uniform vec4 u_LightPosition;\n' + // Position of the light source (in the world coordinate system)
  'uniform vec3 u_AmbientLight;\n' +   // Color of an ambient light
  'uniform vec3 u_colorAmbient;\n' +
  'uniform vec3 u_colorSpec;\n' +
  'uniform float u_shininess;\n' +
  'void main() {\n' +
  '  if (u_drawPolygon) {\n' +
       // Make the length of the normal 1.0
  '    vec3 normal =  normalize(gl_FrontFacing ? v_normal.xyz : -v_normal.xyz);\n' +
      // Calculate the light direction and make it 1.0 in length
  '    vec3 lightDirection = normalize(vec3(u_LightPosition - v_position));\n' +
       // Dot product of the light direction and the orientation of a surface (the normal)
  '    float nDotL = max(dot(lightDirection, normal), 0.0);\n' +
       // Calculate the color due to diffuse reflection
  '    vec3 diffuse = u_LightColor * v_color.rgb * nDotL;\n' +
       // Calculate the color due to ambient reflection
  '    vec3 ambient = u_AmbientLight * u_colorAmbient;\n' +
  '    vec3 r = reflect( -lightDirection, normal );\n' +
  '    vec3 spec = vec3(0.0);\n'+
  '    if( nDotL > 0.0 )\n' +
  '      spec = u_LightColor * u_colorSpec *\n' +
  '             pow( max( dot(r,lightDirection), 0.0 ), u_shininess );\n' +
  '    \n'+
       // Add the surface colors due to diffuse reflection and ambient reflection
  '    gl_FragColor = vec4(spec + diffuse + ambient, v_color.a);\n' +
  '  } else {\n' +
  '    gl_FragColor = v_color;\n' +
  '  }\n' +
 '}\n'
;

function main() {
  // Retrieve <canvas> element
  const canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
  const gl = getWebGLContext(canvas);
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  const viewport = [0, 0, canvas.width, canvas.height];
  gl.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);

  const N = document.getElementById("N");
  const M = document.getElementById("M");
  const alpha = document.getElementById("alpha");

  Data.init(gl, viewport, N, M, alpha);

  canvas.onmousemove = function (ev) { mousemove(ev, canvas); };

  canvas.onmousedown = function (ev) { mousedown(ev, canvas); };

  canvas.onmouseup = function (ev) { mouseup(ev, canvas); };

  (function () {

      function handleMouseWheel(event) {
          event = EventUtil.getEvent(event);
          const delta = EventUtil.getWheelDelta(event);
          Data.mousewheel(delta);
      }

      EventUtil.addHandler(document, "mousewheel", handleMouseWheel);
      EventUtil.addHandler(document, "DOMMouseScroll", handleMouseWheel);

  })();

  const ruledSurface = document.getElementById("chkRuledSurface");
  const visualizeSurfaceWithPoints = document.getElementById("chkVisualizeWithPoints");
  const visualizeSurfaceWithLines = document.getElementById("chkVisualizeWithLines");
  const visualizeSurfaceWithSurface = document.getElementById("chkVisualizeWithSurface");

  ruledSurface.onclick = function () { Data.plotMode(1); };
  visualizeSurfaceWithPoints.onclick = function () { Data.plotMode(4); };
  visualizeSurfaceWithLines.onclick = function () { Data.plotMode(5); };
  visualizeSurfaceWithSurface.onclick = function () { Data.plotMode(6); };

  N.onchange = function () {
      Data.generateBoundaryCurves(N.value);
  };
  M.onchange = function () { Data.plotMode(2); };
  alpha.onchange = function () { Data.plotMode(0); };
   
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.DEPTH_TEST);

  // Specify the color for clearing <canvas>
  gl.clearColor(0.8, 0.8, 0.8, 1.0);

  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  Data.generateBoundaryCurves(N.value);
}

class Point {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

const Camera = {
    //cartesian coordinates
    x0: 0.0,
    y0: 0.0,
    z0: 0.0,
    //spherical coordinates
    r: 0.0,
    theta: 0.0,
    phi: 0.0,
    //initial spherical coordinates
    r_0: 0.0,
    theta_0: 0.0,
    phi_0: 0.0,
    //point the viewer is looking at
    x_ref: 0.0,
    y_ref: 0.0,
    z_ref: 0.0,
    //up vector
    Vx: 0.0,
    Vy: 0.0,
    Vz: 0.0,
    //view volume bounds
    xw_min: 0.0,
    xw_max: 0.0,
    yw_min: 0.0,
    yw_max: 0.0,
    d_near: 0.0,
    d_far: 0.0,
    convertFromCartesianToSpherical: function () {
        const R = this.r + this.r_0;
        const Theta = this.theta + this.theta_0;
        const Phi = this.phi + this.phi_0;

        this.convertFromCartesianToSphericalCoordinates(R, Theta, Phi);

        this.Vx = -R * Math.cos(Theta) * Math.cos(Phi);
        this.Vy = -R * Math.cos(Theta) * Math.sin(Phi);
        this.Vz = R * Math.sin(Theta);

        this.xw_min = -R;
        this.xw_max = R;
        this.yw_min = -R;
        this.yw_max = R;
        this.d_near = 0.0;
        this.d_far = 2 * R;
    },
    convertFromCartesianToSphericalCoordinates: function (r, theta, phi) {
        this.x0 = r * Math.sin(theta) * Math.cos(phi);
        this.y0 = r * Math.sin(theta) * Math.sin(phi);
        this.z0 = r * Math.cos(theta);
    },
    normalizeAngle: function (angle) {
        let lAngle = angle;
        while (lAngle < 0)
            lAngle += 360 * 16;
        while (lAngle > 360 * 16)
            lAngle -= 360 * 16;

        return lAngle;
    },
    getLookAt: function (r, theta, phi) {
        this.r = r;
        this.phi = glMatrix.toRadian(phi / 16.0);
        this.theta = glMatrix.toRadian(theta / 16.0);
        this.convertFromCartesianToSpherical();

        return mat4.lookAt(mat4.create(), 
            [Camera.x0, Camera.y0, Camera.z0], 
            [Camera.x_ref, Camera.y_ref, Camera.z_ref], 
            [Camera.Vx, Camera.Vy, Camera.Vz]);
    },
    getProjMatrix: function() {
        return mat4.ortho(mat4.create(), 
            this.xw_min, this.xw_max, this.yw_min, this.yw_max, this.d_near, this.d_far);
    },
    getAxesPoints: function () {
    		return [0.5 * this.xw_min, 0, 0,
    						this.xw_max, 0, 0,
    						0, 0.5 * this.yw_min, 0,
    						0, this.yw_max, 0,
    						0, 0, -0.5 * (this.d_far - this.d_near) / 2.0,
    						0, 0,  (this.d_far - this.d_near) / 2.0];
    },
    getAxesTipLength: function () {
    		return 0.2 * (this.d_far - this.d_near);

    }
}

const Data = {
    pointsSurface: [],
    indicesSurfaceLines: [],
    indicesSurfaceTriangles: [],
    normalsSurface: [],
	verticesAxes: {},
    verticesC1: {},
    verticesC2: {},
    verticesSurface: {},
    FSIZE: 0,
    ISIZE: 0,
    gl: null,
	vertexBufferAxes: null,
    vertexBufferAxesTip: null,
    vertexBufferC1: null,
    vertexBufferC2: null,
    vertexBufferSurface: null,
	indexBufferCtr: null,
    indexBufferSurfaceLines: null,
    indexBufferSurfaceTriangles: null,
	verticesAxesTip: {},
    a_Position: -1,
    a_normal: -1,
    u_color: null,
    u_pointSize: null,
    u_drawPolygon: false,
    u_mvpMatrix: null,
    u_LightColor: null,
    u_LightPosition: null,
    u_AmbientLight: null,
    u_colorAmbient: null,
    u_colorSpec: null,
    u_shininess: null,
    leftButtonDown: false,
    drawRuledSurface: false,
    visualizeSurfaceWithPoints: true,
    visualizeSurfaceWithLines: false,
    visualizeSurfaceWithSurface: false,
    N: null,
    M: null,
    alpha: null,
    //Area bounds
    xRot: 0,
    yRot: 0,
    wheelDelta: 0.0,
    proj: mat4.create(),
    cam: mat4.create(),
    world: mat4.create(),
    viewport: [],
    lastPosX: 0,
    lastPosY: 0,
    init: function (gl, viewport, N, M, alpha) {
        this.gl = gl;
        
        this.verticesAxes = new Float32Array(18); // 6 points * 3 coordinates
        
        // Create a buffer object
		        this.vertexBufferAxes = this.gl.createBuffer();
        if (!this.vertexBufferAxes) {
            console.log('Failed to create the buffer object for axes');
            return -1;
        }
        
        this.vertexBufferAxesTip = this.gl.createBuffer();
        if (!this.vertexBufferAxesTip) {
            console.log('Failed to create the buffer object for axes tips');
            return -1;
        }
        
        this.vertexBufferC1 = this.gl.createBuffer();
        if (!this.vertexBufferC1) {
            console.log('Failed to create the buffer object for curve 1');
            return -1;
        }
        this.vertexBufferC2 = this.gl.createBuffer();
        if (!this.vertexBufferC2) {
            console.log('Failed to create the buffer object for curve 2');
            return -1;
        }
        this.vertexBufferSurface = this.gl.createBuffer();
        if (!this.vertexBufferSurface) {
            console.log('Failed to create the buffer object for surface points');
            return -1;
        }
        
        this.indexBufferAxesTip = this.gl.createBuffer();
        if (!this.indexBufferAxesTip) {
            console.log('Failed to create the index object for axes tips');
            return -1;
        }

        this.indexBufferSurfaceLines = this.gl.createBuffer();
        if (!this.indexBufferSurfaceLines) {
            console.log('Failed to create the index object for surface lines');
            return -1;
        }

        this.indexBufferSurfaceTriangles = this.gl.createBuffer();
        if (!this.indexBufferSurfaceTriangles) {
            console.log('Failed to create the index object for surface triangles');
            return -1;
        }

        this.a_Position = this.gl.getAttribLocation(this.gl.program, 'a_Position');
        if (this.a_Position < 0) {
            console.log('Failed to get the storage location of a_Position');
            return -1;
        }

        this.a_normal = this.gl.getAttribLocation(this.gl.program, 'a_normal');
        if (this.a_normal < 0) {
            console.log('Failed to get the storage location of a_normal');
            return -1;
        }

        // Get the storage location of u_color
        this.u_color = this.gl.getUniformLocation(this.gl.program, 'u_color');
        if (!this.u_color) {
            console.log('Failed to get u_color variable');
            return;
        }

        // Get the storage location of u_pointSize
        this.u_pointSize = gl.getUniformLocation(this.gl.program, 'u_pointSize');
        if (!this.u_pointSize) {
            console.log('Failed to get u_pointSize variable');
            return;
        }

        // Get the storage location of u_drawPolygon
        this.u_drawPolygon = this.gl.getUniformLocation(this.gl.program, 'u_drawPolygon');
        if (!this.u_drawPolygon) {
            console.log('Failed to get u_drawPolygon variable');
            return;
        }

        // Get the storage location of u_LightColor
        this.u_LightColor = gl.getUniformLocation(gl.program, 'u_LightColor');
        if (!this.u_LightColor) {
            console.log('Failed to get u_LightColor variable');
            return;
        }

        // Get the storage location of u_LightPosition
        this.u_LightPosition = gl.getUniformLocation(gl.program, 'u_LightPosition');
        if (!this.u_LightPosition) {
            console.log('Failed to get u_LightPosition variable');
            return;
        }

        // Get the storage location of u_AmbientLight
        this.u_AmbientLight = gl.getUniformLocation(gl.program, 'u_AmbientLight');
        if (!this.u_AmbientLight) {
            console.log('Failed to get u_AmbientLight variable');
            return;
        }

        // Get the storage location of u_colorAmbient
        this.u_colorAmbient = gl.getUniformLocation(gl.program, 'u_colorAmbient');
        if (!this.u_colorAmbient) {
            console.log('Failed to get u_colorAmbient variable');
            return;
        }

        // Get the storage location of u_colorSpec
        this.u_colorSpec = gl.getUniformLocation(gl.program, 'u_colorSpec');
        if (!this.u_colorSpec) {
            console.log('Failed to get u_colorSpec variable');
            return;
        }

        // Get the storage location of u_shininess
        this.u_shininess = gl.getUniformLocation(gl.program, 'u_shininess');
        if (!this.u_shininess) {
            console.log('Failed to get u_shininess variable');
            return;
        }

        this.u_mvpMatrix = gl.getUniformLocation(gl.program, 'u_mvpMatrix');
        if (!this.u_mvpMatrix) {
            console.log('Failed to get the storage location of u_mvpMatrix');
            return;
        }

        this.gl.uniform3f(this.u_LightColor, 1.0, 1.0, 1.0);
        // Set the ambient light
        this.gl.uniform3f(this.u_AmbientLight, 0.2, 0.2, 0.2);
        // Set the material ambient color
        this.gl.uniform3f(this.u_colorSpec, 0.2313, 0.2313, 0.2313);
        // Set the material specular color
        this.gl.uniform3f(this.u_colorSpec, 0.7739, 0.7739, 0.7739);
        // Set the material shininess
        this.gl.uniform1f(this.u_shininess, 90);

        this.viewport = viewport;

        this.N = N;
        this.M = M;
        this.alpha = alpha;
    },
    setDependentGeomParameters: function () {
        Camera.r_0 = Math.sqrt(Math.pow(1.0 / 2.0, 2) +
           Math.pow(1.0 / 2.0, 2) +
           Math.pow(0.3, 2));

        this.resetCamera(false);
    },
    yt: function(x, t) { 
        // https://en.wikipedia.org/wiki/NACA_airfoil
        return 5*t*(0.2969*Math.sqrt(x) - 0.1260*x - 0.3516*(x**2) + 0.2843*(x**3) - 0.1015*(x**4));
    },
    yt_x: function (x, t) {
        //������� ����������� dyt/dx
        return 5*t*(0.14845/Math.sqrt(x)-0.126-0.7032*x+0.8529*(x**2)-0.4060*(x**3));
    },
    c1: function (u, pt) {
        const t = 0.3;
        let x, z;
        if (u < 0.5) {
            x = 2*u;
            z = this.yt(x, t);
        }
        else {
            x = 2*(1-u);
            z = -this.yt(x, t);
        }

        pt.x = x - 0.5;
        pt.y = -0.5;
        pt.z = z;
    },
    c1_u: function (u, pt) {
        const t = 0.3
        let x, z;
        if (u < 0.5) {
            x = 2;
            z = this.yt_x(x, t);
        }
        else {
            x = -2;
            z = -this.yt_x(x, t);
        }

        pt.x = x - 0.5;
        pt.y = -0.5;
        pt.z = z;
    },
    c2: function (u, pt) {
        const t = 0.15;
        let x, z;
        if (u < 0.5) {
            x = 2*u;
            z = this.yt(x, t);
        }
        else {
            x = 2*(1-u);
            z = -this.yt(x, t);
        }

        pt.x = x - 0.5;
        pt.y = 0.5;
        pt.z = z;
    },
    c2_u: function (u, pt) {
        const t = 0.15;
        let x, z;
        if (u < 0.5) {
            x = 2;
            z = this.yt_x(x, t);
        }
        else {
            x = -2;
            z = -this.yt_x(x, t);
        }

        pt.x = x - 0.5;
        pt.y = 0.5;
        pt.z = z;
    },
    generateBoundaryCurves: function (n) {

        this.verticesC1 = new Float32Array(3 * n);
        this.verticesC2 = new Float32Array(3 * n);

        const pt = new Point();

        this.setDependentGeomParameters();

        for (let i = 0; i < n; i++)
        {
            const t = i / (n - 1);

            this.c1(t, pt);
            this.verticesC1[i * 3]     = pt.x;
            this.verticesC1[i * 3 + 1] = pt.y;
            this.verticesC1[i * 3 + 2] = pt.z;

            this.c2(t, pt);
            this.verticesC2[i * 3] = pt.x;
            this.verticesC2[i * 3 + 1] = pt.y;
            this.verticesC2[i * 3 + 2] = pt.z;
        }

        this.FSIZE = this.verticesC1.BYTES_PER_ELEMENT;

        if (this.drawRuledSurfaces)
            this.calculateRuledSurface();

        this.setVertexBuffersAndDraw();
    },
    resetCamera: function (resetAngles) {
    	if (resetAngles) {
        this.xRot = 0;
        this.yRot = 0;
      }
        this.wheelDelta = 0.0;
    },
    setLeftButtonDown: function(value){
        this.leftButtonDown = value;
    },
        setAxes: function () {
    		this.verticesAxes.set(Camera.getAxesPoints());
    },
    create_coord_tip: function () {
        let r, phi, x, y, z;
        let i, j, k;

        let pt;

				const height = Camera.getAxesTipLength();
        const rTop = 0;
        const rBase = 0.25 * height;
        this.nLongitudes = 36;
        this.nLatitudes = 2;

        const count = this.nLatitudes * this.nLongitudes * 3; //x,y,z
        this.verticesAxesTip = new Float32Array(count);

        k = 0;
        for (i = 0; i < this.nLatitudes; i++)
            for (j = 0; j < this.nLongitudes; j++) {
                r = rBase + (rTop - rBase) / (this.nLatitudes - 1) * i;
                phi = 2 * Math.PI / this.nLongitudes * j;

                x = r * Math.cos(phi);
                y = r * Math.sin(phi);
                z = height / (this.nLatitudes - 1) * i - height;

                //console.log("p = ", p, "  q = ", q, "  i = ", i, "  j = ", j, "  x = ", x, "  y = ", y, "  z = ", z);

                this.verticesAxesTip[k++] = x;
                this.verticesAxesTip[k++] = y;
                this.verticesAxesTip[k++] = z;
            }
    },
    create_indexes_tip: function () {
        let i, j, k, p, q;
        let m_countTipIndices;
        let indicesVectorCtr;

        const countIndices = (this.nLatitudes - 1) * this.nLongitudes * 2 * 3;
        
        this.indicesAxesTip = new Uint16Array(countIndices);

        k = 0;

        for (i = 0; i < this.nLatitudes - 1; i++)
            for (j = 0; j < this.nLongitudes; j++) {
                if (j != this.nLongitudes - 1) {
                    this.indicesAxesTip[k++] = this.nLongitudes * i + j;
                    this.indicesAxesTip[k++] = this.nLongitudes * i + j + 1;
                    this.indicesAxesTip[k++] = this.nLongitudes * (i + 1) + j + 1;

                    this.indicesAxesTip[k++] = this.nLongitudes * (i + 1) + j + 1;
                    this.indicesAxesTip[k++] = this.nLongitudes * (i + 1) + j;
                    this.indicesAxesTip[k++] = this.nLongitudes * i + j;
                }
                else {
                    this.indicesAxesTip[k++] = this.nLongitudes * i + j;
                    this.indicesAxesTip[k++] = this.nLongitudes * i;
                    this.indicesAxesTip[k++] = this.nLongitudes * (i + 1);

                    this.indicesAxesTip[k++] = this.nLongitudes * (i + 1);
                    this.indicesAxesTip[k++] = this.nLongitudes * (i + 1) + j;
                    this.indicesAxesTip[k++] = this.nLongitudes * i + j;
                }
            }
    },
    createindicesSurfaceLines: function (n, m) {
        let i, j, k = 0;
        this.indicesSurfaceLines = new Uint16Array(2 * n * m);
        this.ISIZE = this.indicesSurfaceLines.BYTES_PER_ELEMENT;

        for (i = 0; i < n; i++) {
            for (j = 0; j < m; j++)
                this.indicesSurfaceLines[k++] = i * m + j;
        }
        for (j = 0; j < m; j++) {
            for (i = 0; i < n; i++)
                this.indicesSurfaceLines[k++] = i * m + j;
        }
    },
    createindicesSurfaceTriangles: function (n, m) {
        let k = 0;
        this.indicesSurfaceTriangles = new Uint16Array(6 * (n-1) * (m-1));

        for (let i = 0; i < n-1; i++)
            for (let j = 0; j < m-1; j++) {
                this.indicesSurfaceTriangles[k++] = i * m + j;
                this.indicesSurfaceTriangles[k++] = (i+1) * m + j;
                this.indicesSurfaceTriangles[k++] = i * m + j+1;
                this.indicesSurfaceTriangles[k++] = i * m + j+1;
                this.indicesSurfaceTriangles[k++] = (i + 1) * m + j;
                this.indicesSurfaceTriangles[k++] = (i + 1) * m + j+1;
            }
    },
    setXRotation: function(angle)
    {
        const lAngle = Camera.normalizeAngle(angle);
        if (lAngle != this.xRot) {
            this.xRot = lAngle;
        }
    },
    setYRotation: function(angle)
    {
        const lAngle = Camera.normalizeAngle(angle);
        if (lAngle != this.yRot) {
            this.yRot = lAngle;
        }
    },
    mousemoveHandler: function (x, y) {
        if (this.leftButtonDown) {
            const dx = x - this.lastPosX;
            const dy = y - this.lastPosY;

            this.setXRotation(this.xRot - 8 * dy);
            this.setYRotation(this.yRot + 8 * dx);

            this.lastPosX = x;
            this.lastPosY = y;

            this.setVertexBuffersAndDraw();
        }
    },
    mousedownHandler: function (button, x, y) {
        switch (button) {
            case 0: //left button
                this.lastPosX = x;
                this.lastPosY = y;

                this.setLeftButtonDown(true);
                break;
            case 2: //right button
                this.resetCamera(true);
                this.setVertexBuffersAndDraw();
                break;
        }
    },
    mouseupHandler: function (button, x, y) {
        if (button == 0) //left button
            this.setLeftButtonDown(false);
    },
    mousewheel: function (delta) {
        const d = Camera.r_0 * (-1.) * delta / 1000.0;
        if ((this.wheelDelta + d >= -Camera.r_0) && (this.wheelDelta + d <= Camera.r_0*3.0))
            this.wheelDelta += d;

        this.setVertexBuffersAndDraw();
    },
    setVertexBuffersAndDraw: function () {
        let q, rotateMatrix, translateMatrix, transformMatrix, axesTransformMatrix;
        
        this.cam = Camera.getLookAt(this.wheelDelta, this.xRot, this.yRot);
        this.proj = Camera.getProjMatrix();

        this.gl.uniform4f(this.u_LightPosition, Camera.x0, Camera.y0, Camera.z0, 1.0);

        this.gl.uniform1f(this.u_drawPolygon, false);

        // Clear <canvas>
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        
        this.setAxes();
        this.create_coord_tip();
        this.create_indexes_tip();
        
        // Bind the buffer object to target
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferAxes);
        // Write date into the buffer object
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesAxes, this.gl.DYNAMIC_DRAW);
        // Assign the buffer object to a_Position variable
        this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, 0, 0);
        // Enable the assignment to a_Position variable
        this.gl.enableVertexAttribArray(this.a_Position);
        // Disable the assignment to a_normal variable
        this.gl.disableVertexAttribArray(this.a_normal);
        
        const axes_scale = 0.1;
        const half_axes_scale_length = 1.5 * (this.verticesAxes[17] - this.verticesAxes[14]) * axes_scale / 2;
        const scaleMatrix = mat4.fromScaling(mat4.create(), [axes_scale, axes_scale, axes_scale]);
        translateMatrix = mat4.fromTranslation(mat4.create(), vec3.fromValues(this.verticesAxes[3] - half_axes_scale_length, //x_max - half_axes_scale_length
        																																			-this.verticesAxes[10] + half_axes_scale_length, //-y_max + half_axes_scale_length 
        																																			this.verticesAxes[17] - half_axes_scale_length)); //z_max - half_axes_scale_length 
		    transformMatrix = mat4.mul(mat4.create(), scaleMatrix, this.world);
		    transformMatrix = mat4.mul(mat4.create(), this.cam, transformMatrix);
		    transformMatrix = mat4.mul(mat4.create(), translateMatrix, transformMatrix);
		    transformMatrix = mat4.mul(mat4.create(), this.proj, transformMatrix);
		    this.gl.uniformMatrix4fv(this.u_mvpMatrix, false, transformMatrix);
        
        // Draw
        this.gl.uniform4f(this.u_color, 1.0, 0.0, 0.0, 1.0);
        this.gl.drawArrays(this.gl.LINES, 0, 2);
        this.gl.uniform4f(this.u_color, 0.0, 1.0, 0.0, 1.0);
        this.gl.drawArrays(this.gl.LINES, 2, 2);
        this.gl.uniform4f(this.u_color, 0.0, 0.0, 1.0, 1.0);
        this.gl.drawArrays(this.gl.LINES, 4, 2);
        
        const countTipIndices = (this.nLatitudes - 1) * this.nLongitudes * 2 * 3;
        // Bind the buffer object to target
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferAxesTip);
        // Write date into the buffer object
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesAxesTip, this.gl.DYNAMIC_DRAW);
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBufferAxesTip);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.indicesAxesTip, this.gl.DYNAMIC_DRAW);
        // Assign the buffer object to a_Position variable
        this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, 0, 0);
        // Enable the assignment to a_Position variable
        this.gl.enableVertexAttribArray(this.a_Position);
        // Disable the assignment to a_normal variable
        this.gl.disableVertexAttribArray(this.a_normal);
        this.gl.uniform4f(this.u_color, 0.0, 0.0, 0.0, 1.0);

				for (let i=0; i<3; i++) {
						switch (i) {
						case 0:
        				q = quat.rotationTo(quat.create(), [0.0, 0.0, 1.0], [1.0, 0.0, 0.0]);
		        		translateMatrix = mat4.fromTranslation(mat4.create(), vec3.fromValues(this.verticesAxes[3], this.verticesAxes[4], this.verticesAxes[5])); //x_max
								break;
						case 1:
        				q = quat.rotationTo(quat.create(), [0.0, 0.0, 1.0], [0.0, 1.0, 0.0]);
		        		translateMatrix = mat4.fromTranslation(mat4.create(), vec3.fromValues(this.verticesAxes[9], this.verticesAxes[10], this.verticesAxes[11])); //y_max
								break;
						case 2:
        				q = quat.rotationTo(quat.create(), [0.0, 0.0, 1.0], [0.0, 0.0, 1.0]);
		        		translateMatrix = mat4.fromTranslation(mat4.create(), vec3.fromValues(this.verticesAxes[15], this.verticesAxes[16], this.verticesAxes[17])); //z_max
								break;
						}
		        rotateMatrix = mat4.fromQuat(mat4.create(), q);
		        axesTransformMatrix = mat4.mul(mat4.create(), translateMatrix, rotateMatrix);
		        axesTransformMatrix = mat4.mul(mat4.create(), transformMatrix, axesTransformMatrix);
		        this.gl.uniformMatrix4fv(this.u_mvpMatrix, false, axesTransformMatrix);
		        this.gl.drawElements(this.gl.TRIANGLES, countTipIndices, this.gl.UNSIGNED_SHORT, 0);
            
        }
        
        const mvMatr = mat4.mul(mat4.create(), this.cam, this.world);
        const mvpMatr = mat4.mul(mat4.create(), this.proj, mvMatr);
        
        this.gl.uniformMatrix4fv(this.u_mvpMatrix, false, mvpMatr);
        
        // Bind the buffer object to target
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferC1);
        // Write date into the buffer object
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesC1, this.gl.STATIC_DRAW);
        // Assign the buffer object to a_Position variable
        this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, 0, 0);
        // Enable the assignment to a_Position variable
        this.gl.enableVertexAttribArray(this.a_Position);
        // Disable the assignment to a_normal variable
        this.gl.disableVertexAttribArray(this.a_normal);

        this.gl.uniform4f(this.u_color, 0.0, 0.0, 0.0, 1.0);
        this.gl.uniform1f(this.u_pointSize, 3.0);

        // Draw
        this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.N.value);

        // Bind the buffer object to target
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferC2);
        // Write date into the buffer object
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesC2, this.gl.STATIC_DRAW);
        // Assign the buffer object to a_Position variable
        this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, 0, 0);
        // Enable the assignment to a_Position variable
        this.gl.enableVertexAttribArray(this.a_Position);
        // Disable the assignment to a_normal variable
        this.gl.disableVertexAttribArray(this.a_normal);

        this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.N.value);

        if (this.drawRuledSurfaces)
        {
            // Bind the buffer object to target
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferSurface);
            // Write date into the buffer object
            this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesSurface, this.gl.DYNAMIC_DRAW);
            //var FSIZE = this.verticesSurface.BYTES_PER_ELEMENT;
            // Assign the buffer object to a_Position variable
            this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, this.FSIZE * 6, 0);
            // Assign the buffer object to a_normal variable
            this.gl.vertexAttribPointer(this.a_normal, 3, this.gl.FLOAT, false, this.FSIZE * 6, this.FSIZE * 3);
            // Enable the assignment to a_Position variable
            this.gl.enableVertexAttribArray(this.a_Position);
            // Enable the assignment to a_normal variable
            this.gl.enableVertexAttribArray(this.a_normal);

            this.gl.uniform4f(this.u_color, 1.0, 0.0, 0.0, 1.0);
            this.gl.uniform1f(this.u_pointSize, 5.0);
            //points
            if (this.visualizeSurfaceWithPoints)
                this.gl.drawArrays(this.gl.POINTS, 0, this.N.value * this.M.value);
            //lines
            if (this.visualizeSurfaceWithLines) {
                this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBufferSurfaceLines);
                this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.indicesSurfaceLines, this.gl.DYNAMIC_DRAW);

                this.gl.uniform4f(this.u_color, 0.0, 1.0, 1.0, 1.0);

                for (let i = 0; i < this.N.value; i++) {
                    this.gl.drawElements(this.gl.LINE_STRIP, this.M.value, this.gl.UNSIGNED_SHORT, ((i * this.M.value) * this.ISIZE));
                }

                this.gl.uniform4f(this.u_color, 1.0, 0.0, 1.0, 1.0);

                for (let j = 0; j < this.M.value; j++) {
                    this.gl.drawElements(this.gl.LINE_STRIP, this.N.value, this.gl.UNSIGNED_SHORT, ((this.N.value * this.M.value + j * this.N.value) * this.ISIZE));
                }
            }
            //surface
            if (this.visualizeSurfaceWithSurface) {
                this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBufferSurfaceTriangles);
                this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.indicesSurfaceTriangles, this.gl.DYNAMIC_DRAW);

                this.gl.uniform1f(this.u_drawPolygon, true);
                this.gl.depthMask(false);
                this.gl.enable(this.gl.BLEND);
                this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
                this.gl.uniform4f(this.u_color, 0.2775, 0.2775, 0.2775, this.alpha.value);
                this.gl.drawElements(this.gl.TRIANGLES, 6 * (this.N.value - 1) * (this.M.value - 1), this.gl.UNSIGNED_SHORT, 0);
                this.gl.disable(this.gl.BLEND);
                this.gl.depthMask(true);
            }
        }
    },
    plotMode: function(selOption){
        switch (selOption)
        {
            case 1:
                this.drawRuledSurfaces = !this.drawRuledSurfaces;
                if (this.drawRuledSurfaces)
                    this.calculateRuledSurface();
                break;
            case 2:
                if (this.drawRuledSurfaces)
                    this.calculateRuledSurface();
                break;
            case 4:
                this.visualizeSurfaceWithPoints = !this.visualizeSurfaceWithPoints;
                break;
            case 5:
                this.visualizeSurfaceWithLines = !this.visualizeSurfaceWithLines;
                break;
            case 6:
                this.visualizeSurfaceWithSurface = !this.visualizeSurfaceWithSurface;
                break;
        }
        this.setVertexBuffersAndDraw();
    },
    calculateRuledSurface: function(){

        let i, j, tau, t;
        let pt;

        const N = eval(this.N.value);
        const M = eval(this.M.value);

        this.pointsSurface = new Array(N);
        this.normalsSurface = new Array(N);
        for (i = 0; i < N; i++) {
            this.pointsSurface[i] = new Array(M);
            this.normalsSurface[i] = new Array(M);
            for (j = 0; j < M; j++)
                this.normalsSurface[i][j] = new Array(3);
        }

        const pt1 = new Point();
        const pt2 = new Point();

        const pt1_u = new Point();
        const pt2_u = new Point();

        for (i = 0; i < N; i++) {
			t = i/(N-1);
			this.c1(t, pt1);
			this.c2(t, pt2);
			this.c1_u(t, pt1_u);
			this.c2_u(t, pt2_u);
           for (j = 0; j < M; j++) {
				tau = j/(M-1);

				const x = pt1.x * (1 - tau) + pt2.x * tau;
				const y = pt1.y * (1 - tau) + pt2.y * tau;
				const z = pt1.z * (1 - tau) + pt2.z * tau;

				pt = new Point(x, y, z);
				this.pointsSurface[i][j] = pt;

				// calculate tangent vectors
				const x_t = pt1_u.x * (1 - tau) + pt2_u.x * tau;
				const y_t = pt1_u.y * (1 - tau) + pt2_u.y * tau;
				const z_t = pt1_u.z * (1 - tau) + pt2_u.z * tau

				const x_tau = pt2.x - pt1.x;
				const y_tau = pt2.y - pt1.y;
				const z_tau = pt2.z - pt1.z;
				  
				const pt_t = vec3.fromValues(x_t, y_t, z_t);
				const pt_tau = vec3.fromValues(x_tau, y_tau, z_tau);
				  
				// CALCULATE NORMAL VECTOR

				let normal = vec3.create();
				normal = vec3.cross(normal, pt_t, pt_tau);

				this.normalsSurface[i][j][0] = normal[0];
				this.normalsSurface[i][j][1] = normal[1];
				this.normalsSurface[i][j][2] = normal[2];
           }
        }

        this.verticesSurface = new Float32Array(N * M * 6);
        for (i = 0; i < N; i++)
            for (j = 0; j < M; j++) {
                this.verticesSurface[(i * M + j) * 6] = this.pointsSurface[i][j].x;
                this.verticesSurface[(i * M + j) * 6 + 1] = this.pointsSurface[i][j].y;
                this.verticesSurface[(i * M + j) * 6 + 2] = this.pointsSurface[i][j].z;
                this.verticesSurface[(i * M + j) * 6 + 3] = this.normalsSurface[i][j][0];
                this.verticesSurface[(i * M + j) * 6 + 4] = this.normalsSurface[i][j][1];
                this.verticesSurface[(i * M + j) * 6 + 5] = this.normalsSurface[i][j][2];
            }

        this.createindicesSurfaceLines(N, M);
        this.createindicesSurfaceTriangles(N, M);
    }
}

function mousedown(ev, canvas) {
    const x = ev.clientX; // x coordinate of a mouse pointer
    const y = ev.clientY; // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect();

    Data.mousedownHandler(EventUtil.getButton(ev), x - rect.left, canvas.height - (y - rect.top));
}

function mouseup(ev, canvas) {
    const x = ev.clientX; // x coordinate of a mouse pointer
    const y = ev.clientY; // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect();

    Data.mouseupHandler(EventUtil.getButton(ev), x - rect.left, canvas.height - (y - rect.top));
}

function mousemove(ev, canvas)
{
    const x = ev.clientX; // x coordinate of a mouse pointer
    const y = ev.clientY; // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect();

    Data.mousemoveHandler(x - rect.left, canvas.height - (y - rect.top));
}