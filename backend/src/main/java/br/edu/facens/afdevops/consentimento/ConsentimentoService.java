package br.edu.facens.afdevops.consentimento;

import java.time.Instant;
import java.time.OffsetDateTime;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class ConsentimentoService {
    private final JdbcClient jdbc;

    ConsentimentoService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public boolean autorizadoParaIa(long colaboradorId) {
        return consultar(colaboradorId).autorizado();
    }

    Decisao consultar(long colaboradorId) {
        return jdbc.sql("""
                SELECT autorizado, decidido_em FROM consentimentos_ia WHERE colaborador_id = :colaboradorId
                """).param("colaboradorId", colaboradorId)
                .query((rs, linha) -> new Decisao(rs.getBoolean("autorizado"),
                        rs.getObject("decidido_em", OffsetDateTime.class).toInstant()))
                .optional().orElseGet(() -> new Decisao(false, null));
    }

    Decisao decidir(long colaboradorId, boolean autorizado) {
        return jdbc.sql("""
                INSERT INTO consentimentos_ia (colaborador_id, autorizado, decidido_em)
                VALUES (:colaboradorId, :autorizado, clock_timestamp())
                ON CONFLICT (colaborador_id) DO UPDATE
                SET autorizado = EXCLUDED.autorizado, decidido_em = clock_timestamp()
                RETURNING autorizado, decidido_em
                """).param("colaboradorId", colaboradorId).param("autorizado", autorizado)
                .query((rs, linha) -> new Decisao(rs.getBoolean("autorizado"),
                        rs.getObject("decidido_em", OffsetDateTime.class).toInstant()))
                .single();
    }

    record Decisao(boolean autorizado, @JsonInclude(JsonInclude.Include.ALWAYS) Instant decididoEm) {
    }
}
