package br.edu.facens.afdevops.treinamento;

import org.springframework.data.jpa.repository.JpaRepository;

interface SolicitacaoTreinamentoRepository extends JpaRepository<SolicitacaoTreinamento, Long> {
}
