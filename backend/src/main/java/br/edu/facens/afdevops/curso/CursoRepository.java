package br.edu.facens.afdevops.curso;

import org.springframework.data.jpa.repository.JpaRepository;

interface CursoRepository extends JpaRepository<Curso, Long> {
}
