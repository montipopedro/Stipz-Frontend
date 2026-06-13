import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
import { ApiService } from '../services/api';
import { StipzStateService } from '../services/stipz-state';
import { FeedbackService } from '../services/feedback';


@Component({
  selector: 'app-cadastrar-sala',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './cadastrar-sala.html',
  styleUrls: ['./cadastrar-sala.css']
})

export class CadastrarSala {
  constructor(
    private api: ApiService,
    private state: StipzStateService,
    private cdr: ChangeDetectorRef,
    private feedback: FeedbackService
  ) {}

  sala = {
    nome: '',
    capacidade: 0
  };

  erros: string[] = [];

  limparMensagens() {
  }

  async cadastrar() {
    this.erros = [];
    this.limparMensagens();

    if (!this.sala.nome.trim()) {
      this.erros.push('Nome da sala: informe um nome.');
    }

    if (!this.sala.capacidade || this.sala.capacidade < 1) {
      this.erros.push('Capacidade: informe uma quantidade maior que zero.');
    }

    if (this.erros.length > 0) {
      this.feedback.erro(this.erros);
      return;
    }

    const confirmado = await this.feedback.confirmar(
      'Cadastrar sala?',
      `Confirma o cadastro da sala ${this.sala.nome} com capacidade para ${this.sala.capacidade} pessoas?`,
      'Cadastrar'
    );
    if (!confirmado) return;

    this.api.criarSala(this.sala).subscribe({
      next: (salaCriada) => {
        this.state.adicionarSala({
          nome: salaCriada?.nome || this.sala.nome,
          capacidade: Number(salaCriada?.capacidade || this.sala.capacidade)
        });
        this.sala = { nome: '', capacidade: 0 };
        this.feedback.sucesso('Sala cadastrada com sucesso.');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.feedback.erro(this.feedback.mensagemErro(err, 'Não foi possível cadastrar a sala.'));
        this.cdr.detectChanges();
      }
    });
  }
}
