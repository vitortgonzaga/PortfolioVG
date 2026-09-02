import { CommonModule } from "@angular/common";
import type * as THREE from "three";
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
} from "@angular/core";

interface Project {
  name: string;
  status: string;
  stack: string[];
  link?: string;
  [key: string]: string | number | boolean | string[] | undefined;
}

const LOGS = [
  "INFO  http  GET /v1/devices/8821 200 12ms",
  "INFO  ingest sensor batch=412 lag=0ms",
  "DEBUG cache hit ratio=0.94 keys=18244",
  "INFO  http  POST /v1/readings 201 34ms",
  "WARN  pool  connections=18/20 waiting=1",
  "INFO  etl   report:daily rows=18244 ok",
  "INFO  es    index=records refresh 120ms",
  "DEBUG trace 4f2c9a span=authz 3.1ms",
  "INFO  http  GET /health 200 1ms",
  "INFO  s3    archive batch=2026-09-02 flushed",
];

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild("host", { static: true }) host!: ElementRef<HTMLElement>;
  @ViewChild("sceneCanvas", { static: true })
  sceneCanvas!: ElementRef<HTMLCanvasElement>;
  theme: "dark" | "light" = "dark";
  language: "pt" | "en" = "en";
  activeSection = "home";
  modalOpen = false;
  copied = false;
  log = "INFO  boot · portfolio ready";
  terminalLines = [
    "INFO  boot      api-gateway ready",
    "INFO  queue     consumer lag=0ms",
    "DEBUG cache    hit-ratio=0.94",
    "INFO  postgres  pool=18/20",
    "INFO  deploy    production healthy",
  ];
  private animationFrame = 0;
  private logTimer?: ReturnType<typeof setInterval>;
  private logIndex = -1;
  private resizeObserver?: ResizeObserver;
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private galaxy?: THREE.Points;
  private galaxyMaterial?: THREE.PointsMaterial;
  private themePulses: Array<{ mesh: THREE.Mesh; born: number }> = [];
  private themeColorTransition?: {
    from: THREE.Color;
    to: THREE.Color;
    start: number;
  };
  private three?: typeof import("three");

  readonly projects: Project[] = [
    {
      name: "fintech-core",
      status: "in_progress",
      stack: ["java", "spring-boot", "kafka", "postgres", "redis", "docker"],
      events_per_day: 120000,
      p99_ms: 41,
      test_coverage: 0.86,
    },
    {
      name: "pixel-forge",
      status: "live",
      stack: ["next.js", "typescript", "p5.js", "canvas"],
      link: "https://www.pixelforge3d.com.br",
      active_students: 200,
      ttfb_ms: 120,
      lighthouse: 96,
    },
    {
      name: "groovetree",
      status: "live",
      stack: ["next.js"],
      link: "https://groovetr.ee",
    },
    {
      name: "iot-ingestion",
      status: "confidential",
      stack: ["python", "aws-ec2", "sql", "linux"],
      ingest_latency_ms: 148,
      uptime: 0.9998,
      devices: 340,
    },
    {
      name: "eye-tracking",
      status: "research",
      stack: ["python", "dart", "opencv"],
      link: "/assets/ARTIGO_ELA.pdf",
      detection_accuracy: 0.92,
      fps: 30,
      paper_published: true,
    },
    {
      name: "etl-pipelines",
      status: "confidential",
      stack: ["python", "rest-apis", "sql"],
      manual_entry_reduced: 0.8,
      jobs_per_day: 96,
      failure_rate: 0.004,
    },
  ];

  constructor() {
    this.startLogs();
  }

  ngAfterViewInit(): void {
    this.syncPageBackground();
    this.initGalaxy();
  }

  private async initGalaxy(): Promise<void> {
    this.three = await import("three");
    const three = this.three;
    const canvas = this.sceneCanvas.nativeElement;
    this.renderer = new three.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.scene = new three.Scene();
    this.camera = new three.PerspectiveCamera(46, 1, 0.1, 100);
    this.camera.position.z = 4.4;
    const count = 130000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
      const radius = Math.pow(Math.random(), 1.5) * 7.2;
      const arm = index % 5;
      const angle =
        arm * ((Math.PI * 2) / 5) +
        radius * 0.92 +
        (Math.random() - 0.5) * (0.42 + radius * 0.1);
      const spread = (Math.random() - 0.5) * (0.12 + radius * 0.09);
      positions[index * 3] = Math.cos(angle) * radius + spread;
      positions[index * 3 + 1] = Math.sin(angle) * radius * 0.72 + spread;
      positions[index * 3 + 2] = (Math.random() - 0.5) * (0.3 + radius * 0.11);
      const brightness =
        Math.max(0.16, 1 - radius / 8.2) * (0.55 + Math.random() * 0.45);
      colors[index * 3] = brightness * 0.725;
      colors[index * 3 + 1] = brightness * 0.725;
      colors[index * 3 + 2] = brightness * 0.725;
    }
    const geometry = new three.BufferGeometry();
    geometry.setAttribute("position", new three.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new three.BufferAttribute(colors, 3));
    this.galaxyMaterial = new three.PointsMaterial({
      color: 0xb9b9b9,
      vertexColors: true,
      size: 0.0105,
      transparent: true,
      opacity: 0.74,
      sizeAttenuation: true,
    });
    this.galaxy = new three.Points(geometry, this.galaxyMaterial);
    this.galaxy.rotation.z = -0.2;
    this.scene.add(this.galaxy);

    const resize = () => {
      const { clientWidth: width, clientHeight: height } =
        this.host.nativeElement;
      if (!this.renderer || !this.camera || !width || !height) return;
      const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    };
    resize();
    this.resizeObserver = new ResizeObserver(resize);
    this.resizeObserver.observe(this.host.nativeElement);
    let lastFrame = 0;
    const frame = (timestamp = 0) => {
      if (timestamp - lastFrame < 33) {
        this.animationFrame = requestAnimationFrame(frame);
        return;
      }
      lastFrame = timestamp;
      if (this.galaxy) {
        this.galaxy.rotation.z += 0.0022;
        this.galaxy.rotation.y = Math.sin(timestamp * 0.00035) * 0.1;
      }
      if (this.themeColorTransition && this.galaxyMaterial) {
        const { from, to, start } = this.themeColorTransition;
        const progress = Math.min(1, (timestamp - start) / 400);
        const eased = 1 - Math.pow(1 - progress, 3);
        this.galaxyMaterial.color.copy(from).lerp(to, eased);
        if (progress >= 1) this.themeColorTransition = undefined;
      }
      this.themePulses = this.themePulses.filter((pulse) => {
        const progress = Math.min(1, (timestamp - pulse.born) / 720);
        pulse.mesh.scale.setScalar(0.08 + progress * 4.5);
        (pulse.mesh.material as THREE.MeshBasicMaterial).opacity =
          (1 - progress) * 0.42;
        if (progress >= 1) {
          this.scene?.remove(pulse.mesh);
          pulse.mesh.geometry.dispose();
          (pulse.mesh.material as THREE.Material).dispose();
          return false;
        }
        return true;
      });
      this.renderer?.render(this.scene!, this.camera!);
      this.animationFrame = requestAnimationFrame(frame);
    };
    frame();
  }

  @HostListener("window:keydown", ["$event"])
  closeWithEscape(event: KeyboardEvent): void {
    if (event.key === "Escape") this.modalOpen = false;
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrame);
    if (this.logTimer) clearInterval(this.logTimer);
    this.resizeObserver?.disconnect();
  }

  selectSection(id: string): void {
    this.activeSection = id;
  }
  openProject(project: Project, event: Event): void {
    if (project.status === "confidential") {
      event.preventDefault();
      this.modalOpen = true;
    }
  }
  async copyEmail(): Promise<void> {
    try {
      await navigator.clipboard.writeText("vitortgonzaga@icloud.com");
    } catch {
      /* clipboard may be unavailable */
    }
    this.copied = true;
    setTimeout(() => (this.copied = false), 1600);
  }
  setTheme(theme: "dark" | "light", event?: MouseEvent): void {
    if (theme === this.theme) return;
    this.theme = theme;
    this.startGalaxyColorTransition(theme === "light" ? 0x2b2b2b : 0xb9b9b9);
    this.syncPageBackground();
    this.createThemePulse(event);
  }

  private startGalaxyColorTransition(target: number): void {
    if (!this.three || !this.galaxyMaterial) return;
    this.themeColorTransition = {
      from: this.galaxyMaterial.color.clone(),
      to: new this.three.Color(target),
      start: performance.now(),
    };
  }

  private createThemePulse(event?: MouseEvent): void {
    if (!this.three || !this.scene || !this.camera || !this.renderer) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x =
      (((event?.clientX ?? rect.right - 40) - rect.left) / rect.width) * 2 - 1;
    const y = -(
      (((event?.clientY ?? rect.top + 25) - rect.top) / rect.height) * 2 -
      1
    );
    const point = new this.three.Vector3(x, y, 0.2).unproject(this.camera);
    const mesh = new this.three.Mesh(
      new this.three.RingGeometry(0.12, 0.15, 48),
      new this.three.MeshBasicMaterial({
        color: this.theme === "light" ? 0x2b2b2b : 0xb9b9b9,
        transparent: true,
        opacity: 0.42,
        side: this.three.DoubleSide,
      }),
    );
    mesh.position.copy(point);
    mesh.lookAt(this.camera.position);
    this.scene.add(mesh);
    this.themePulses.push({ mesh, born: performance.now() });
  }
  private syncPageBackground(): void {
    document.documentElement.classList.toggle(
      "theme-light",
      this.theme === "light",
    );
  }

  setLanguage(language: "pt" | "en"): void {
    this.language = language;
  }
  isPt(): boolean {
    return this.language === "pt";
  }

  private startLogs(): void {
    this.logTimer = setInterval(() => {
      this.logIndex = (this.logIndex + 1) % LOGS.length;
      this.log = LOGS[this.logIndex];
    }, 2600);
  }
}
