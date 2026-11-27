package br.edu.facens.afdevops.identidade;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

import org.postgresql.util.PSQLException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContasIndividuais {
    private static final Pattern NOME = Pattern.compile("[A-Za-z0-9_.-]{1,64}");

    private final ContaRepository repository;
    private final PasswordEncoder encoder;
    private final InMemoryUserDetailsManager demonstracao;

    ContasIndividuais(ContaRepository repository, PasswordEncoder encoder, InMemoryUserDetailsManager demonstracao) {
        this.repository = repository;
        this.encoder = encoder;
        this.demonstracao = demonstracao;
    }

    @Transactional(readOnly = true)
    public Optional<ContaAutenticada> buscarParaAutenticacao(String nome) {
        if (!NOME.matcher(nome).matches()) {
            return Optional.empty();
        }
        return repository.buscarPeloNome(normalizar(nome)).map(ContaAutenticada::new);
    }

    @Transactional(readOnly = true)
    public void verificarNomesDeDemonstracao(String... nomes) {
        for (String nome : nomes) {
            if (repository.buscarPeloNome(normalizar(nome)).isPresent()) {
                throw new IllegalStateException("A configuração de demonstração conflita com uma conta individual.");
            }
        }
    }

    @Transactional
    public ContaCriada criar(long colaboradorId, String nome, String senha) {
        if (colaboradorId <= 0 || nome == null || !NOME.matcher(nome).matches() || !senhaValida(senha)) {
            throw falha(HttpStatus.BAD_REQUEST, "DADOS_INVALIDOS", "Informe um nome de usuário e uma senha válidos.");
        }
        String normalizado = normalizar(nome);
        if (demonstracao.userExists(normalizado)) {
            throw nomeIndisponivel();
        }

        var conta = new ContaColaborador(normalizado, encoder.encode(senha), colaboradorId,
                Instant.now().truncatedTo(ChronoUnit.MICROS));
        try {
            repository.saveAndFlush(conta);
        } catch (DataIntegrityViolationException erro) {
            for (Throwable causa = erro; causa != null; causa = causa.getCause()) {
                if (causa instanceof PSQLException pg && pg.getServerErrorMessage() != null) {
                    String restricao = pg.getServerErrorMessage().getConstraint();
                    if ("23503".equals(pg.getSQLState()) && "fk_contas_colaborador".equals(restricao)) {
                        throw falha(HttpStatus.NOT_FOUND, "COLABORADOR_NAO_ENCONTRADO", "Colaborador não encontrado.");
                    }
                    if (!"23505".equals(pg.getSQLState())) {
                        continue;
                    }
                    if ("uq_contas_colaborador".equals(restricao)) {
                        throw falha(HttpStatus.CONFLICT, "CONTA_DUPLICADA", "O colaborador já possui uma conta.");
                    }
                    if ("ux_contas_nome_usuario_lower".equals(restricao)) {
                        throw nomeIndisponivel();
                    }
                }
            }
            throw erro;
        }
        return new ContaCriada(conta.getId(), normalizado, "COLABORADOR", colaboradorId, conta.getCriadoEm());
    }

    private static boolean senhaValida(String senha) {
        return senha != null && senha.length() <= 72 && !senha.isBlank() && senha.indexOf(0) == -1
                && senha.codePointCount(0, senha.length()) >= 12 && StandardCharsets.UTF_8.newEncoder().canEncode(senha)
                && senha.getBytes(StandardCharsets.UTF_8).length <= 72;
    }

    private static String normalizar(String nome) {
        return nome.toLowerCase(Locale.ROOT);
    }

    private static Falha nomeIndisponivel() {
        return falha(HttpStatus.CONFLICT, "NOME_USUARIO_INDISPONIVEL", "Nome de usuário indisponível.");
    }

    private static Falha falha(HttpStatus status, String codigo, String detalhe) {
        return new Falha(status, codigo, detalhe);
    }

    record ContaCriada(Long id, String nomeUsuario, String perfil, Long colaboradorId, Instant criadoEm) {
    }

    static final class Falha extends RuntimeException {
        final HttpStatus status;
        final String codigo;

        Falha(HttpStatus status, String codigo, String detalhe) {
            super(detalhe);
            this.status = status;
            this.codigo = codigo;
        }
    }
}
