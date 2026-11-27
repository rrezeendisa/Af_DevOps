package br.edu.facens.afdevops.identidade;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface ContaRepository extends JpaRepository<ContaColaborador, Long> {
    @Query("select c from ContaColaborador c where lower(c.nomeUsuario) = :nomeNormalizado")
    Optional<ContaColaborador> buscarPeloNome(String nomeNormalizado);
}
