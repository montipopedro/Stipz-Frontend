import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type FeedbackTipo = 'sucesso' | 'erro' | 'aviso' | 'info';

export interface FeedbackMensagem {
  tipo: FeedbackTipo;
  titulo: string;
  mensagens: string[];
}

export interface FeedbackConfirmacao {
  titulo: string;
  mensagem: string;
  textoConfirmar: string;
  textoCancelar: string;
  perigosa: boolean;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private mensagemSubject = new BehaviorSubject<FeedbackMensagem | null>(null);
  private confirmacaoSubject = new BehaviorSubject<FeedbackConfirmacao | null>(null);
  private resolverConfirmacao?: (confirmado: boolean) => void;
  private timer?: number;

  readonly mensagem$ = this.mensagemSubject.asObservable();
  readonly confirmacao$ = this.confirmacaoSubject.asObservable();

  sucesso(mensagem: string | string[], titulo = 'Operação concluída') {
    this.exibir('sucesso', titulo, mensagem);
  }

  erro(mensagem: string | string[], titulo = 'Verifique os dados') {
    this.exibir('erro', titulo, mensagem, 6500);
  }

  aviso(mensagem: string | string[], titulo = 'Atenção') {
    this.exibir('aviso', titulo, mensagem, 5500);
  }

  info(mensagem: string | string[], titulo = 'Informação') {
    this.exibir('info', titulo, mensagem);
  }

  fecharMensagem() {
    if (this.timer) window.clearTimeout(this.timer);
    this.mensagemSubject.next(null);
  }

  confirmar(
    titulo: string,
    mensagem: string,
    textoConfirmar = 'Confirmar',
    textoCancelar = 'Cancelar',
    perigosa = false
  ): Promise<boolean> {
    if (this.resolverConfirmacao) {
      this.resolverConfirmacao(false);
    }

    this.confirmacaoSubject.next({
      titulo,
      mensagem,
      textoConfirmar,
      textoCancelar,
      perigosa
    });

    return new Promise<boolean>((resolve) => {
      this.resolverConfirmacao = resolve;
    });
  }

  responderConfirmacao(confirmado: boolean) {
    this.confirmacaoSubject.next(null);
    this.resolverConfirmacao?.(confirmado);
    this.resolverConfirmacao = undefined;
  }

  mensagemErro(error: any, fallback: string): string[] {
    const mensagensValidacao = this.extrairValidacoes(error?.error);
    if (mensagensValidacao.length) return mensagensValidacao;

    const texto = this.primeiroTexto([
      error?.error?.erro,
      error?.error?.message,
      error?.error?.detail,
      typeof error?.error === 'string' ? error.error : ''
    ]);

    if (texto) return [this.sanitizar(texto, fallback)];
    if (error?.status === 0) return ['Não foi possível comunicar com o servidor. Tente novamente em instantes.'];
    if (error?.status === 400) return ['Alguns dados informados são inválidos. Revise os campos e tente novamente.'];
    if (error?.status === 401) return ['Sua sessão expirou. Entre novamente para continuar.'];
    if (error?.status === 403) return ['Seu usuário não possui permissão para realizar esta operação.'];
    if (error?.status === 404) return ['O registro solicitado não foi encontrado. Atualize a tela e tente novamente.'];
    if (error?.status === 409) return ['A operação não pôde ser concluída porque os dados estão em conflito.'];
    return [fallback];
  }

  private exibir(
    tipo: FeedbackTipo,
    titulo: string,
    mensagem: string | string[],
    duracao = 4500
  ) {
    if (this.timer) window.clearTimeout(this.timer);

    const mensagens = (Array.isArray(mensagem) ? mensagem : [mensagem])
      .map((item) => this.sanitizar(String(item), 'Não foi possível concluir a operação.'))
      .filter(Boolean);

    this.mensagemSubject.next({ tipo, titulo, mensagens });
    this.timer = window.setTimeout(() => this.mensagemSubject.next(null), duracao);
  }

  private extrairValidacoes(conteudo: any): string[] {
    const origem = conteudo?.errors || conteudo?.erros || conteudo?.fieldErrors;
    if (!origem) return [];

    if (Array.isArray(origem)) {
      return origem
        .map((item) => {
          const campo = item?.field || item?.campo;
          const mensagem = item?.defaultMessage || item?.message || item?.mensagem || item;
          return this.formatarCampo(campo, mensagem);
        })
        .filter(Boolean);
    }

    if (typeof origem === 'object') {
      return Object.entries(origem)
        .map(([campo, mensagem]) => this.formatarCampo(campo, mensagem))
        .filter(Boolean);
    }

    return [];
  }

  private formatarCampo(campo: unknown, mensagem: unknown): string {
    const texto = Array.isArray(mensagem) ? mensagem.join(', ') : String(mensagem || '');
    const nomeCampo = this.nomeCampo(String(campo || ''));
    const limpo = this.sanitizar(texto, 'Valor inválido.');
    return nomeCampo && !limpo.toLowerCase().includes(nomeCampo.toLowerCase())
      ? `${nomeCampo}: ${limpo}`
      : limpo;
  }

  private nomeCampo(campo: string): string {
    const nomes: Record<string, string> = {
      nome: 'Nome',
      email: 'E-mail',
      senha: 'Senha',
      perfil: 'Perfil',
      salaId: 'Sala',
      capacidade: 'Capacidade',
      quantidade: 'Quantidade',
      descricao: 'Descrição',
      categoria: 'Categoria',
      inicio: 'Data e horário inicial',
      fim: 'Data e horário final',
      quantidadeParticipantes: 'Quantidade de participantes',
      responsavel: 'Responsável',
      nomeResponsavel: 'Nome do responsável',
      recursos: 'Recursos'
    };
    return nomes[campo] || campo.replace(/([A-Z])/g, ' $1').trim();
  }

  private sanitizar(texto: string, fallback: string): string {
    const limpo = texto
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/[A-Za-z]:\\[^\s]+/g, '')
      .replace(/\/(?:api\/)?[a-z0-9_-]+(?:\/[a-z0-9_{}.-]+)+/gi, '')
      .replace(/\b(?:GET|POST|PUT|PATCH|DELETE)\s+\S+/gi, '')
      .replace(/\b[\w.$]+(?:Exception|Error)\b:?/g, '')
      .replace(/\s+at\s+[\w.$]+\([^)]*\)/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return limpo || fallback;
  }

  private primeiroTexto(valores: unknown[]): string {
    return valores.find((valor) => typeof valor === 'string' && valor.trim()) as string || '';
  }
}
