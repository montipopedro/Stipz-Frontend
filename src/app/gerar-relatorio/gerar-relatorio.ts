import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '../services/api';
import { Reserva, StipzStateService } from '../services/stipz-state';
import { SincronizacaoService } from '../services/sincronizacao';
import { FeedbackService } from '../services/feedback';

@Component({
  selector: 'app-gerar-relatorio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gerar-relatorio.html',
  styleUrls: ['./gerar-relatorio.css']
})
export class GerarRelatorioComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  filtros = {
    dataInicio: '',
    dataFim: '',
    sala: ''
  };
  erros: string[] = [];
  carregando = false;

  constructor(
    public state: StipzStateService,
    private api: ApiService,
    private sincronizacao: SincronizacaoService,
    private cdr: ChangeDetectorRef,
    private feedback: FeedbackService
  ) {}

  ngOnInit() {
    this.carregarSalas();

    this.sincronizacao.alteracao$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.carregarSalas());
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  carregarSalas() {
    this.api.listarSalas().subscribe({
      next: (salas) => {
        this.state.setSalas(salas);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  async gerar() {
    this.erros = [];
    if (!this.filtros.dataInicio) this.erros.push('Data inicial: selecione o início do período.');
    if (!this.filtros.dataFim) this.erros.push('Data final: selecione o fim do período.');
    if (this.filtros.dataInicio && this.filtros.dataFim && this.filtros.dataFim < this.filtros.dataInicio) {
      this.erros.push('Data final: deve ser igual ou posterior à data inicial.');
    }
    if (!this.filtros.sala) this.erros.push('Sala: selecione a sala do relatório.');
    if (this.erros.length > 0) {
      this.feedback.erro(this.erros);
      return;
    }

    const confirmado = await this.feedback.confirmar(
      'Gerar relatório?',
      `Deseja gerar o relatório de ${this.filtros.sala} para o período selecionado?`,
      'Gerar PDF'
    );
    if (!confirmado) return;

    this.carregando = true;
    this.api.gerarRelatorio(this.filtros).subscribe({
      next: async (reservas) => {
        const reservasNormalizadas = this.normalizarReservas(reservas);
        const reservasFiltradas = this.filtrarReservas(reservasNormalizadas);

        await this.gerarPdf(reservasFiltradas);
        this.carregando = false;
        this.feedback.sucesso('Relatório gerado e baixado com sucesso.');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.carregando = false;
        this.feedback.erro(this.feedback.mensagemErro(err, 'Não foi possível gerar o relatório.'));
        this.cdr.detectChanges();
      }
    });
  }

  private normalizarReservas(reservas: any[]): Reserva[] {
    return (reservas || []).map((reserva) => {
      const solicitante = reserva.solicitante ||
        reserva.nomeSolicitante ||
        reserva.usuarioSolicitante ||
        reserva.usuario?.nome ||
        reserva.usuario?.name ||
        '';

      return {
        id: reserva.id,
        eventoId: reserva.eventoId,
        solicitante,
        sala: reserva.sala?.nome || reserva.sala || reserva.nomeSala || '',
        data: this.extrairData(reserva.dataInicio || reserva.inicio || reserva.data || reserva.dataReserva || reserva.dia),
        horaInicio: this.extrairHora(reserva.dataInicio || reserva.inicio || reserva.horaInicio || reserva.horarioInicio),
        horaFim: this.extrairHora(reserva.dataFim || reserva.fim || reserva.horaFim || reserva.horarioFim),
        recursos: Array.isArray(reserva.recursos)
          ? reserva.recursos.map((recurso: any) => {
              const nome = recurso.nome || recurso.recurso?.nome || recurso.recurso || recurso;
              const quantidade = Number(recurso.quantidade);
              return quantidade > 0 ? `${nome} x${quantidade}` : nome;
            })
          : [],
        responsavel: reserva.responsavel || reserva.nomeResponsavel || solicitante,
        cadeirasExtras: Boolean(reserva.cadeirasExtras),
        quantidadeCadeiras: Number(reserva.quantidadeCadeiras || 0),
        status: reserva.status || 'PENDENTE',
        evento: reserva.evento || reserva.nomeEvento,
        observacoes: reserva.observacoes
      };
    });
  }

  private filtrarReservas(reservas: Reserva[]): Reserva[] {
    const inicio = new Date(`${this.filtros.dataInicio}T00:00:00`);
    const fim = new Date(`${this.filtros.dataFim}T23:59:59`);

    return reservas.filter((reserva) => {
      const dataReserva = new Date(`${reserva.data}T12:00:00`);
      const mesmaSala = reserva.sala === this.filtros.sala;
      return mesmaSala && dataReserva >= inicio && dataReserva <= fim;
    });
  }

  private async gerarPdf(reservas: Reserva[]): Promise<void> {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const larguraPagina = doc.internal.pageSize.getWidth();
    const alturaPagina = doc.internal.pageSize.getHeight();
    const margem = 16;
    let y = 20;

    this.desenharCabecalhoRelatorio(doc, larguraPagina);
    y = 50;
    y = this.desenharBlocoFiltros(doc, margem, y, larguraPagina);
    y = this.desenharResumo(doc, reservas, margem, y, larguraPagina);

    if (reservas.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(82, 104, 109);
      doc.text('Nenhuma reserva encontrada para os filtros selecionados.', margem, y + 8);
      this.desenharRodapes(doc);
      doc.save(this.nomeArquivo());
      return;
    }

    y += 6;
    this.desenharCabecalhoTabela(doc, y);
    y += 9;

    reservas.forEach((reserva, index) => {
      if (y > alturaPagina - 24) {
        doc.addPage();
        this.desenharCabecalhoRelatorio(doc, larguraPagina, true);
        y = 42;
        this.desenharCabecalhoTabela(doc, y);
        y += 9;
      }

      this.desenharLinhaTabela(doc, reserva, y, index);
      y += 10;
    });

    this.desenharRodapes(doc);
    doc.save(this.nomeArquivo());
  }

  private desenharCabecalhoRelatorio(doc: any, larguraPagina: number, compacto = false): void {
    doc.setFillColor(26, 60, 66);
    doc.rect(0, 0, larguraPagina, compacto ? 30 : 38, 'F');
    doc.setFillColor(70, 146, 160);
    doc.rect(0, compacto ? 29 : 37, larguraPagina, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(compacto ? 17 : 20);
    doc.setTextColor(255, 255, 255);
    doc.text('Stipz', 16, compacto ? 17 : 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(compacto ? 9 : 10);
    doc.text('Relatório gerencial de reservas', 16, compacto ? 24 : 28);

    if (!compacto) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Reservas de salas e recursos', larguraPagina - 16, 18, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, larguraPagina - 16, 26, { align: 'right' });
    }
  }

  private desenharBlocoFiltros(doc: any, margem: number, y: number, larguraPagina: number): number {
    const largura = larguraPagina - margem * 2;
    doc.setFillColor(247, 251, 252);
    doc.setDrawColor(217, 231, 234);
    doc.roundedRect(margem, y, largura, 25, 2, 2, 'FD');

    doc.setTextColor(82, 104, 109);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('SALA', margem + 6, y + 8);
    doc.text('PERIODO', margem + 76, y + 8);
    doc.text('RESPONSAVEL PELO RELATORIO', margem + 138, y + 8);

    doc.setTextColor(23, 35, 38);
    doc.setFontSize(10);
    doc.text(this.filtros.sala, margem + 6, y + 16);
    doc.text(`${this.formatarData(this.filtros.dataInicio)} a ${this.formatarData(this.filtros.dataFim)}`, margem + 76, y + 16);
    doc.text('Administrador', margem + 138, y + 16);

    return y + 35;
  }

  private desenharResumo(doc: any, reservas: Reserva[], margem: number, y: number, larguraPagina: number): number {
    const totais = this.contarStatus(reservas);
    const cards = [
      { titulo: 'Total', valor: reservas.length, cor: [70, 146, 160] },
      { titulo: 'Aprovadas', valor: totais.aprovadas, cor: [43, 138, 89] },
      { titulo: 'Pendentes', valor: totais.pendentes, cor: [218, 150, 40] },
      { titulo: 'Canceladas/recusadas', valor: totais.encerradas, cor: [189, 74, 84] }
    ];
    const gap = 4;
    const larguraCard = (larguraPagina - margem * 2 - gap * 3) / 4;

    cards.forEach((card, index) => {
      const x = margem + index * (larguraCard + gap);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(217, 231, 234);
      doc.roundedRect(x, y, larguraCard, 22, 2, 2, 'FD');
      doc.setFillColor(card.cor[0], card.cor[1], card.cor[2]);
      doc.rect(x, y, 3, 22, 'F');

      doc.setTextColor(82, 104, 109);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(card.titulo.toUpperCase(), x + 7, y + 8);
      doc.setTextColor(23, 35, 38);
      doc.setFontSize(15);
      doc.text(String(card.valor), x + 7, y + 17);
    });

    return y + 32;
  }

  private desenharCabecalhoTabela(doc: any, y: number): void {
    const margem = 14;

    doc.setFillColor(26, 60, 66);
    doc.roundedRect(margem, y - 6, 182, 8, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Data', margem + 2, y);
    doc.text('Horario', 39, y);
    doc.text('Responsavel', 70, y);
    doc.text('Status', 124, y);
    doc.text('Recursos', 154, y);
    doc.setTextColor(23, 35, 38);
  }

  private desenharLinhaTabela(doc: any, reserva: Reserva, y: number, index: number): void {
    const margem = 14;
    const fill = index % 2 === 0 ? 249 : 255;
    doc.setFillColor(fill, fill === 249 ? 252 : 255, fill === 249 ? 253 : 255);
    doc.setDrawColor(230, 238, 240);
    doc.rect(margem, y - 6, 182, 10, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(23, 35, 38);
    doc.text(this.formatarData(reserva.data), margem + 2, y);
    doc.text(`${reserva.horaInicio || '-'}-${reserva.horaFim || '-'}`, 39, y);
    doc.text(this.limitarTexto(reserva.responsavel || '-', 30), 70, y);

    this.desenharStatus(doc, reserva.status || 'PENDENTE', 124, y - 5);

    doc.setTextColor(23, 35, 38);
    doc.setFont('helvetica', 'normal');
    doc.text(this.limitarTexto((reserva.recursos || []).join(', ') || '-', 30), 154, y);
  }

  private desenharStatus(doc: any, status: string, x: number, y: number): void {
    const statusNormalizado = status.toUpperCase();
    const cores: Record<string, number[]> = {
      APROVADA: [43, 138, 89],
      PENDENTE: [218, 150, 40],
      REJEITADA: [189, 74, 84],
      RECUSADA: [189, 74, 84],
      CANCELADA: [120, 132, 137]
    };
    const cor = cores[statusNormalizado] || [70, 146, 160];
    doc.setFillColor(cor[0], cor[1], cor[2]);
    doc.roundedRect(x, y, 24, 5.5, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.text(this.limitarTexto(statusNormalizado, 11), x + 12, y + 3.8, { align: 'center' });
  }

  private desenharRodapes(doc: any): void {
    const totalPaginas = doc.getNumberOfPages();
    const larguraPagina = doc.internal.pageSize.getWidth();
    const alturaPagina = doc.internal.pageSize.getHeight();

    for (let pagina = 1; pagina <= totalPaginas; pagina++) {
      doc.setPage(pagina);
      doc.setDrawColor(217, 231, 234);
      doc.line(14, alturaPagina - 14, larguraPagina - 14, alturaPagina - 14);
      doc.setTextColor(120, 132, 137);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Stipz - Controle de reservas', 14, alturaPagina - 8);
      doc.text(`Pagina ${pagina} de ${totalPaginas}`, larguraPagina - 14, alturaPagina - 8, { align: 'right' });
    }
  }

  private contarStatus(reservas: Reserva[]): { aprovadas: number; pendentes: number; encerradas: number } {
    return reservas.reduce(
      (total, reserva) => {
        const status = reserva.status?.toUpperCase();
        if (status === 'APROVADA') total.aprovadas += 1;
        if (status === 'PENDENTE') total.pendentes += 1;
        if (status === 'REJEITADA' || status === 'RECUSADA' || status === 'CANCELADA') total.encerradas += 1;
        return total;
      },
      { aprovadas: 0, pendentes: 0, encerradas: 0 }
    );
  }

  private extrairData(valor: string): string {
    return valor?.includes('T') ? valor.split('T')[0] : valor || '';
  }

  private extrairHora(valor: string): string {
    if (!valor) return '';
    const hora = valor.includes('T') ? valor.split('T')[1] : valor;
    return hora?.slice(0, 5) || '';
  }

  private limitarTexto(texto: string, limite: number): string {
    return texto.length > limite ? `${texto.slice(0, limite - 3)}...` : texto;
  }

  private formatarData(data: string): string {
    if (!data) return '-';
    const [ano, mes, dia] = data.split('-');
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : data;
  }

  private nomeArquivo(): string {
    const sala = this.filtros.sala.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    return `relatorio-reservas-${sala}-${this.filtros.dataInicio}-${this.filtros.dataFim}.pdf`;
  }
}
