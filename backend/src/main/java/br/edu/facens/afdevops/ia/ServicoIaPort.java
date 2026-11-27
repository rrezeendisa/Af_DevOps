package br.edu.facens.afdevops.ia;

interface ServicoIaPort {
    IaDtos.Classificacao classificar(IaDtos.Competencias competencias);

    IaDtos.Recomendacoes recomendar(IaDtos.PedidoRecomendacao pedido);

    IaDtos.Orientacao orientar(long colaboradorId, IaDtos.PedidoOrientacao pedido);
}
