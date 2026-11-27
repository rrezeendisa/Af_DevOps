package br.edu.facens.afdevops.ia;

import java.util.regex.Pattern;

import br.edu.facens.afdevops.consentimento.ConsentimentoService;
import br.edu.facens.afdevops.identidade.ContaAutenticada;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

@Service
class IaService {
    private static final Pattern ORIENTACAO_PYTHON = Pattern.compile(
            "A classificação estimada pelo modelo é (INICIANTE|INTERMEDIARIO|AVANCADO)\\. "
                    + "(?:Os documentos consultados recomendam: [^\\r\\n]+\\."
                    + "|Não foram encontrados cursos compatíveis nos documentos disponíveis\\.)");

    private final ConsentimentoService consentimento;
    private final ServicoIaPort ia;
    private final ObjectProvider<ProximosPassosPort> gerador;

    IaService(ConsentimentoService consentimento, ServicoIaPort ia, ObjectProvider<ProximosPassosPort> gerador) {
        this.consentimento = consentimento;
        this.ia = ia;
        this.gerador = gerador;
    }

    IaDtos.Classificacao classificar(ContaAutenticada conta, IaDtos.Competencias pedido) {
        verificarConsentimento(conta);
        return ia.classificar(pedido);
    }

    IaDtos.Recomendacoes recomendar(ContaAutenticada conta, IaDtos.PedidoRecomendacao pedido) {
        verificarConsentimento(conta);
        return ia.recomendar(pedido);
    }

    IaDtos.Orientacao orientar(ContaAutenticada conta, IaDtos.PedidoOrientacao pedido) {
        verificarConsentimento(conta);
        var base = ia.orientar(conta.colaboradorId(), pedido);
        var formato = ORIENTACAO_PYTHON.matcher(base.orientacao());
        if (!formato.matches()) {
            return base;
        }
        var complemento = gerador.getIfAvailable();
        if (complemento == null || !consentimento.autorizadoParaIa(conta.colaboradorId())) {
            return base;
        }
        var passos = complemento.gerar(IaDtos.Nivel.valueOf(formato.group(1)));
        return passos.isEmpty() ? base
                : new IaDtos.Orientacao(base.orientacao(), base.cursosRecomendados(), base.fontes(), passos);
    }

    private void verificarConsentimento(ContaAutenticada conta) {
        if (!consentimento.autorizadoParaIa(conta.colaboradorId())) {
            throw IaFalha.CONSENTIMENTO_IA_NECESSARIO.erro();
        }
    }
}
