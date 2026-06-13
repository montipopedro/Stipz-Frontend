import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './services/theme';
import { AuthService } from './services/auth';
import { NotificacoesService } from './services/notificacoes';
import { FeedbackGlobalComponent } from './feedback-global/feedback-global';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, FeedbackGlobalComponent],
  template: `<router-outlet></router-outlet><app-feedback-global></app-feedback-global>`
})
export class AppComponent {
  constructor(
    private theme: ThemeService,
    private auth: AuthService,
    private notificacoes: NotificacoesService
  ) {
    this.auth.usuario$.subscribe((usuario) => {
      if (usuario || this.auth.temToken()) {
        this.notificacoes.conectar();
        return;
      }

      this.notificacoes.desconectar();
    });
  }
}
