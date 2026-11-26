package br.edu.facens.afdevops;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.SQLException;
import java.util.UUID;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.Location;
import org.flywaydb.core.api.MigrationState;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationInitializer;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(AfdevopsApplicationTests.PostgresConfiguration.class)
class AfdevopsApplicationTests {

    @LocalServerPort
    private int port;

    @Autowired
    private DataSource dataSource;

    @Autowired
    private PostgreSQLContainer postgres;

    @Autowired
    private Flyway flyway;

    @Autowired
    private FlywayMigrationInitializer flywayInitializer;

    private final HttpClient client = HttpClient.newHttpClient();

    @Test
    void contextLoads() {
    }

    @Test
    void jdbcConnectsToDisposablePostgres() throws SQLException {
        try (var connection = dataSource.getConnection()) {
            assertThat(connection.getMetaData().getURL()).isEqualTo(postgres.getJdbcUrl());
            assertThat(connection.getMetaData().getDatabaseMajorVersion()).isEqualTo(17);

            try (var statement = connection.createStatement();
                    var result = statement.executeQuery("SELECT current_database(), current_user")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getString(1)).isEqualTo(postgres.getDatabaseName());
                assertThat(result.getString(2)).isEqualTo(postgres.getUsername());
            }
        }
    }

    @Test
    void flywayUsesDisposablePostgresAndHasNoPendingMigrations() throws SQLException {
        assertThat(flywayInitializer).isNotNull();
        assertThat(flyway.getConfiguration().getLocations())
                .extracting(Location::getDescriptor)
                .containsExactly("classpath:db/migration");

        try (var connection = flyway.getConfiguration().getDataSource().getConnection()) {
            assertThat(connection.getMetaData().getURL()).isEqualTo(postgres.getJdbcUrl());
        }
        assertThat(flyway.info().pending()).isEmpty();
        assertThat(flyway.info().applied()).anySatisfy(migration -> {
            assertThat(migration.getVersion().getVersion()).isEqualTo("1");
            assertThat(migration.getState()).isEqualTo(MigrationState.SUCCESS);
        });
    }

    @Test
    void healthReportsUp() throws Exception {
        HttpResponse<String> response = get("/actuator/health");

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("\"status\":\"UP\"");
    }

    @Test
    void otherAdministrativeEndpointsAreNotExposed() throws Exception {
        assertThat(get("/actuator/env").statusCode()).isEqualTo(404);
    }

    private HttpResponse<String> get(String path) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + path))
                .GET()
                .build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class PostgresConfiguration {

        @Bean
        @ServiceConnection
        PostgreSQLContainer postgres() {
            return new PostgreSQLContainer("postgres:17")
                    .withDatabaseName("afdevops_test")
                    .withUsername("afdevops_test")
                    .withPassword(UUID.randomUUID().toString());
        }
    }
}
