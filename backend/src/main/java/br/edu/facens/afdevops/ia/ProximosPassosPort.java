package br.edu.facens.afdevops.ia;

import java.util.List;

interface ProximosPassosPort {
    List<String> gerar(IaDtos.Nivel nivel);
}
