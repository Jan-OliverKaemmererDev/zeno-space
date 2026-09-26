import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
  signal,
  HostListener,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import * as THREE from 'three';
import { AudioService } from '../../../core/services/audio.service';

interface PlanetBody {
  mesh: THREE.Mesh;
  orbitRadius: number;
  orbitSpeed: number;
  angle: number;
  yOffset: number;
  rotationSpeed: number;
  trailPoints: THREE.Vector3[];
  trailLine: THREE.Line;
  color: THREE.Color;
}

@Component({
  selector: 'app-cosmic-sculptor',
  imports: [RouterLink],
  templateUrl: './cosmic-sculptor.component.html',
  styleUrl: './cosmic-sculptor.component.scss',
})
export class CosmicSculptorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  readonly audioService = inject(AudioService);
  private readonly router = inject(Router);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.router.navigate(['/']);
  }

  // Stats & Controls
  readonly planetCount = signal<number>(0);
  readonly timeSpeed = signal<number>(1);
  readonly trailsEnabled = signal<boolean>(true);

  // Three.js instances
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private animationId: number | null = null;

  // Cosmic Objects
  private centralStar!: THREE.Mesh;
  private centralCorona!: THREE.Mesh;
  private planets: PlanetBody[] = [];
  private starParticles!: THREE.Points;

  // Interaction State
  private isDragging = false;
  private previousMousePosition = { x: 0, y: 0 };
  private cameraSpherical = { radius: 45, theta: Math.PI / 4, phi: Math.PI / 3 };

  private readonly pastelColors = [
    0xa78bfa, // Lavender
    0x38bdf8, // Cyan
    0xf472b6, // Rose
    0xfb923c, // Peach
    0x2dd4bf, // Teal
    0xfde047, // Gold
    0x818cf8, // Indigo
  ];

  ngAfterViewInit(): void {
    this.initThree();
    this.createCosmicScene();
    this.animate();
  }

  ngOnDestroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener('resize', this.onWindowResize);

    // Clean up Three.js resources
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
  }

  private initThree(): void {
    const container = this.containerRef.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene & Fog
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x070913, 0.012);

    // Camera
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    this.updateCameraPosition();

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x221a36, 1.2);
    this.scene.add(ambientLight);

    const coreLight = new THREE.PointLight(0xffeedd, 3.5, 120);
    this.scene.add(coreLight);

    window.addEventListener('resize', this.onWindowResize);
  }

  private createCosmicScene(): void {
    // 1. Central Glowing Star
    const starGeo = new THREE.SphereGeometry(3.5, 32, 32);
    const starMat = new THREE.MeshBasicMaterial({
      color: 0xfff2d6,
    });
    this.centralStar = new THREE.Mesh(starGeo, starMat);
    this.scene.add(this.centralStar);

    // Corona Glow
    const coronaGeo = new THREE.SphereGeometry(4.8, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    this.centralCorona = new THREE.Mesh(coronaGeo, coronaMat);
    this.scene.add(this.centralCorona);

    // 2. Starfield Particles
    const particleCount = 2500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      // Sphere spread
      const r = 40 + Math.random() * 120;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i] = r * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = r * Math.cos(phi);

      // Random pastel tint
      const col = new THREE.Color(this.pastelColors[Math.floor(Math.random() * this.pastelColors.length)]);
      colors[i] = col.r;
      colors[i + 1] = col.g;
      colors[i + 2] = col.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.65,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    this.starParticles = new THREE.Points(geometry, material);
    this.scene.add(this.starParticles);

    // 3. Spawn Initial Peaceful System (3 planets)
    this.spawnPlanet(12, 0.012, 1.4, 0x38bdf8);
    this.spawnPlanet(20, 0.008, 2.0, 0xa78bfa, true);
    this.spawnPlanet(30, 0.005, 1.7, 0xf472b6);
  }

  spawnPlanet(
    orbitRadius?: number,
    speed?: number,
    size?: number,
    hexColor?: number,
    hasRings = false
  ): void {
    const radius = orbitRadius ?? (10 + Math.random() * 26);
    const orbitSpeed = speed ?? (0.005 + Math.random() * 0.01);
    const planetSize = size ?? (0.8 + Math.random() * 1.5);
    const colorHex = hexColor ?? this.pastelColors[Math.floor(Math.random() * this.pastelColors.length)];
    const color = new THREE.Color(colorHex);

    // Planet Mesh
    const geo = new THREE.SphereGeometry(planetSize, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.35,
      metalness: 0.1,
      emissive: color,
      emissiveIntensity: 0.25,
    });
    const mesh = new THREE.Mesh(geo, mat);

    // Optional Planetary Rings
    if (hasRings || Math.random() > 0.6) {
      const ringGeo = new THREE.RingGeometry(planetSize * 1.4, planetSize * 2.3, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2.5;
      mesh.add(ring);
    }

    this.scene.add(mesh);

    // Orbit Trail Line
    const maxTrailPoints = 80;
    const trailPoints: THREE.Vector3[] = [];
    const trailGeo = new THREE.BufferGeometry().setFromPoints(
      new Array(maxTrailPoints).fill(new THREE.Vector3())
    );
    const trailMat = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    });
    const trailLine = new THREE.Line(trailGeo, trailMat);
    this.scene.add(trailLine);

    const planet: PlanetBody = {
      mesh,
      orbitRadius: radius,
      orbitSpeed,
      angle: Math.random() * Math.PI * 2,
      yOffset: (Math.random() - 0.5) * 4,
      rotationSpeed: 0.01 + Math.random() * 0.02,
      trailPoints,
      trailLine,
      color,
    };

    this.planets.push(planet);
    this.planetCount.set(this.planets.length);

    // Play chime based on orbit radius
    const noteIndex = Math.floor((radius / 36) * 8);
    this.audioService.playChime(noteIndex, 0.2);
  }

  addRandomPlanet(): void {
    this.spawnPlanet();
    this.audioService.playBubblePop(1.2);
  }

  resetCosmos(): void {
    for (const p of this.planets) {
      this.scene.remove(p.mesh);
      this.scene.remove(p.trailLine);
      p.mesh.geometry.dispose();
      p.trailLine.geometry.dispose();
    }
    this.planets = [];
    this.planetCount.set(0);

    // Recreate peaceful starter system
    this.spawnPlanet(12, 0.012, 1.4, 0x38bdf8);
    this.spawnPlanet(20, 0.008, 2.0, 0xa78bfa, true);
    this.spawnPlanet(30, 0.005, 1.7, 0xf472b6);
  }

  setTimeSpeed(speed: number): void {
    this.timeSpeed.set(speed);
    this.audioService.playChime(speed > 1 ? 5 : 2, 0.15);
  }

  toggleTrails(): void {
    const nextVal = !this.trailsEnabled();
    this.trailsEnabled.set(nextVal);
    for (const p of this.planets) {
      p.trailLine.visible = nextVal;
    }
  }

  // Animation Loop
  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    const speedMultiplier = this.timeSpeed();

    // Rotate central star and corona
    if (this.centralStar) {
      this.centralStar.rotation.y += 0.004 * speedMultiplier;
    }
    if (this.centralCorona) {
      this.centralCorona.rotation.z -= 0.002 * speedMultiplier;
      const scale = 1 + Math.sin(Date.now() * 0.002) * 0.06;
      this.centralCorona.scale.set(scale, scale, scale);
    }

    // Slowly drift starfield
    if (this.starParticles) {
      this.starParticles.rotation.y += 0.0003 * speedMultiplier;
    }

    // Update planets
    for (const p of this.planets) {
      p.angle += p.orbitSpeed * speedMultiplier;
      const x = Math.cos(p.angle) * p.orbitRadius;
      const z = Math.sin(p.angle) * p.orbitRadius;
      const y = Math.sin(p.angle * 2) * p.yOffset;

      p.mesh.position.set(x, y, z);
      p.mesh.rotation.y += p.rotationSpeed * speedMultiplier;

      // Update trail points
      if (this.trailsEnabled()) {
        p.trailPoints.unshift(new THREE.Vector3(x, y, z));
        if (p.trailPoints.length > 70) {
          p.trailPoints.pop();
        }
        p.trailLine.geometry.setFromPoints(p.trailPoints);
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  // Mouse Orbit Controls
  onMouseDown(e: MouseEvent): void {
    this.isDragging = true;
    this.previousMousePosition = { x: e.clientX, y: e.clientY };
  }

  onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.previousMousePosition.x;
    const deltaY = e.clientY - this.previousMousePosition.y;

    this.cameraSpherical.theta -= deltaX * 0.008;
    this.cameraSpherical.phi = Math.max(
      0.1,
      Math.min(Math.PI - 0.1, this.cameraSpherical.phi - deltaY * 0.008)
    );

    this.updateCameraPosition();
    this.previousMousePosition = { x: e.clientX, y: e.clientY };
  }

  onMouseUp(): void {
    this.isDragging = false;
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.cameraSpherical.radius = Math.max(
      15,
      Math.min(90, this.cameraSpherical.radius + e.deltaY * 0.05)
    );
    this.updateCameraPosition();
  }

  private updateCameraPosition(): void {
    const { radius, theta, phi } = this.cameraSpherical;
    this.camera.position.x = radius * Math.sin(phi) * Math.cos(theta);
    this.camera.position.y = radius * Math.cos(phi);
    this.camera.position.z = radius * Math.sin(phi) * Math.sin(theta);
    this.camera.lookAt(0, 0, 0);
  }

  private onWindowResize = (): void => {
    if (!this.containerRef?.nativeElement) return;
    const width = this.containerRef.nativeElement.clientWidth;
    const height = this.containerRef.nativeElement.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };
}
