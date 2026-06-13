import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from "@angular/common";
import { ApiService } from '../services/api';
import { FeedbackService } from '../services/feedback';

@Component({
  selector: 'app-cadastrar-usuario',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './cadastrar-usuario.html',
  styleUrls: ['./cadastrar-usuario.css']
})
export class CadastrarUsuario {

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private feedback: FeedbackService
  ) {}

  usuario = {
    nome: '',
    email: '',
    senha: '',
    perfil: 'COMUM'
  };

  erros: string[] = [];
  carregando: boolean = false;

  limparMensagens() {
  }

  async cadastrar() {
    this.erros = [];

    if (!this.usuario.nome.trim()) {
      this.erros.push('Nome: informe o nome completo do usuário.');
    }

    if (!this.usuario.email.trim()) {
      this.erros.push('E-mail: informe um endereço de e-mail.');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.usuario.email)) {
      this.erros.push('E-mail: informe um endereço válido.');
    }

    if (!this.usuario.senha) {
      this.erros.push('Senha: informe uma senha.');
    } else if (this.usuario.senha.length < 6) {
      this.erros.push('Senha: use pelo menos 6 caracteres.');
    }

    if (this.erros.length > 0) {
      this.feedback.erro(this.erros);
      return;
    }

    const confirmado = await this.feedback.confirmar(
      'Cadastrar usuário?',
      `Confirma o cadastro de ${this.usuario.nome} com perfil ${this.usuario.perfil}?`,
      'Cadastrar'
    );
    if (!confirmado) return;

    this.carregando = true;

    this.api.criarUsuario(this.usuario).subscribe({
      next: () => {

        this.usuario = {
          nome: '',
          email: '',
          senha: '',
          perfil: 'COMUM'
        };

        this.carregando = false;

        this.feedback.sucesso('Usuário cadastrado com sucesso.');
        this.cdr.detectChanges();
      },

      error: (err) => {
        this.feedback.erro(
          this.feedback.mensagemErro(err, 'Não foi possível cadastrar o usuário.')
        );
        this.carregando = false;
        this.cdr.detectChanges();
      }
    });
  }
}
