import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { FeedbackService } from '../services/feedback';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  credenciais = { email: '', senha: '' };
  carregando = false;

  constructor(
    private router: Router,
    private auth: AuthService,
    private feedback: FeedbackService
  ) {}

  entrar() {
    const erros: string[] = [];
    if (!this.credenciais.email.trim()) erros.push('E-mail: informe o e-mail de acesso.');
    if (!this.credenciais.senha) erros.push('Senha: informe sua senha.');
    if (erros.length) {
      this.feedback.erro(erros);
      return;
    }

    this.carregando = true;
    this.auth.login(this.credenciais).subscribe({
      next: () => {
        this.carregando = false;
        this.auth.marcarBoasVindas();
        this.router.navigateByUrl(this.auth.isAdmin() ? '/pendentes' : '/agendamentos');
      },
      error: (err) => {
        this.carregando = false;
        this.feedback.erro(
          this.feedback.mensagemErro(err, 'E-mail ou senha inválidos.'),
          'Não foi possível entrar'
        );
      }
    });
  }
}
