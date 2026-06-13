import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AuthService } from '../services/auth';
import { ThemeService } from '../services/theme';
import { FeedbackService } from '../services/feedback';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './layout.html',
  styleUrls: ['./layout.css']
})
export class LayoutComponent implements OnInit, OnDestroy {
  mostrarBoasVindas = false;
  boasVindasSaindo = false;
  private boasVindasTimer?: number;
  private boasVindasSaidaTimer?: number;
  private boasVindasDelayTimer?: number;
  private subscriptions = new Subscription();

  constructor(
    public auth: AuthService,
    public theme: ThemeService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private feedback: FeedbackService
  ) {}

  ngOnInit(): void {
    this.tentarExibirBoasVindas();

    this.subscriptions.add(
      this.auth.boasVindas$.subscribe(() => this.exibirBoasVindas())
    );

    this.subscriptions.add(
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe(() => this.tentarExibirBoasVindas())
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.boasVindasDelayTimer) {
      window.clearTimeout(this.boasVindasDelayTimer);
    }
    if (this.boasVindasTimer) {
      window.clearTimeout(this.boasVindasTimer);
    }
    if (this.boasVindasSaidaTimer) {
      window.clearTimeout(this.boasVindasSaidaTimer);
    }
  }

  get modoCompacto(): boolean {
    return this.router.url.startsWith('/evento');
  }

  get nomeUsuario(): string {
    const usuario = this.auth.usuarioAtual;
    return usuario?.nome || usuario?.name || usuario?.email || 'Usuário';
  }

  private tentarExibirBoasVindas(): void {
    if (this.auth.consumirBoasVindas()) {
      this.exibirBoasVindasComAtraso();
    }
  }

  private exibirBoasVindasComAtraso(): void {
    if (this.boasVindasDelayTimer) {
      window.clearTimeout(this.boasVindasDelayTimer);
    }

    this.boasVindasDelayTimer = window.setTimeout(() => {
      this.exibirBoasVindas();
    }, 150);
  }

  private exibirBoasVindas(): void {
    if (this.boasVindasTimer) {
      window.clearTimeout(this.boasVindasTimer);
    }
    if (this.boasVindasSaidaTimer) {
      window.clearTimeout(this.boasVindasSaidaTimer);
    }

    this.boasVindasSaindo = false;
    this.mostrarBoasVindas = true;
    this.cdr.detectChanges();

    this.boasVindasTimer = window.setTimeout(() => {
      this.boasVindasSaindo = true;
      this.cdr.detectChanges();
    }, 4200);

    this.boasVindasSaidaTimer = window.setTimeout(() => {
      this.mostrarBoasVindas = false;
      this.boasVindasSaindo = false;
      this.cdr.detectChanges();
    }, 5200);
  }

  alternarTema() {
    this.theme.alternarTema();
  }

  async sair() {
    const confirmado = await this.feedback.confirmar(
      'Sair do sistema?',
      'Sua sessão atual será encerrada.',
      'Sair',
      'Continuar conectado',
      true
    );
    if (confirmado) this.auth.logout();
  }
}
