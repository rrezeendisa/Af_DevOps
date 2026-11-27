package br.edu.facens.afdevops.treinamento;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import br.edu.facens.afdevops.treinamento.dto.AtualizacaoStatusRequest;
import br.edu.facens.afdevops.treinamento.dto.SolicitacaoTreinamentoResponse;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class TreinamentoService {

    static final String MENSAGEM_FALHA_FILA =
            "Não foi possível publicar a solicitação na fila de treinamento.";

    private final SolicitacaoTreinamentoRepository repository;

    TreinamentoService(SolicitacaoTreinamentoRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public SolicitacaoTreinamentoResponse criar(String solicitadoPor) {
        return resposta(repository.save(new SolicitacaoTreinamento(solicitadoPor, agora())));
    }

    @Transactional(readOnly = true)
    public List<SolicitacaoTreinamentoResponse> listar() {
        return repository.findAll(Sort.by("id")).stream().map(TreinamentoService::resposta).toList();
    }

    @Transactional(readOnly = true)
    public SolicitacaoTreinamentoResponse consultar(Long id) {
        return repository.findById(id).map(TreinamentoService::resposta)
                .orElseThrow(SolicitacaoNaoEncontradaException::new);
    }

    @Transactional
    public void atualizarStatus(Long id, AtualizacaoStatusRequest request) {
        var solicitacao = repository.findById(id).orElseThrow(SolicitacaoNaoEncontradaException::new);
        var status = StatusTreinamento.valueOf(request.status());
        String versao = status == StatusTreinamento.CONCLUIDO ? request.versaoModelo() : null;
        solicitacao.atualizar(status, versao, request.mensagem(), agora());
    }

    @Transactional
    public void registrarFalhaEnfileiramento(Long id) {
        repository.findById(id).ifPresent(solicitacao -> solicitacao.atualizar(
                StatusTreinamento.FALHOU, null, MENSAGEM_FALHA_FILA, agora()));
    }

    private static Instant agora() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    private static SolicitacaoTreinamentoResponse resposta(SolicitacaoTreinamento solicitacao) {
        return new SolicitacaoTreinamentoResponse(solicitacao.getId(), solicitacao.getStatus(),
                solicitacao.getSolicitadoPor(), solicitacao.getVersaoModelo(), solicitacao.getMensagem(),
                solicitacao.getCriadoEm(), solicitacao.getAtualizadoEm());
    }

    static class SolicitacaoNaoEncontradaException extends RuntimeException {
    }
}
