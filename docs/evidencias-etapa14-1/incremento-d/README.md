# RNF01 com autenticação por sessão — Etapa 14.1

**Meta atingida no ambiente ensaiado**, em 28/11/2026, em uma rodada por patamar. Com 300 usuários
simultâneos, as 17.826 interações iniciadas na janela de 120 s terminaram com classificação válida em até 2 s.

| Indicador em 300 usuários | Resultado | Meta |
|---|---:|---:|
| Oficial: POSTs válidos em até 2 s | 100% (17.826 de 17.826) | 95% |
| Complementar: interações (sessão, CSRF e POST) válidas em até 2 s | 100% (17.826 de 17.826) | 95% |

## Resultados

| Usuários / sessões | Interações válidas | POST/s | POST p50 / p90 / p95 / p99 (ms) | Interação p50 / p90 / p95 / p99 (ms) | Login p95 (ms) |
|---:|---:|---:|---|---|---:|
| 10 / 10 | 599 / 599 | 4,99 | 13 / 16 / 18 / 22 | 18 / 24 / 26 / 31 | 595 |
| 50 / 50 | 2.972 / 2.972 | 24,77 | 10 / 14 / 16 / 23 | 14 / 19 / 22 / 32 | 502 |
| 100 / 100 | 5.954 / 5.954 | 49,61 | 9 / 14 / 16 / 21 | 12 / 19 / 21 / 27 | 504 |
| 200 / 200 | 11.923 / 11.923 | 99,36 | 9 / 16 / 21 / 40 | 12 / 20 / 25 / 47 | 592 |
| 300 / 300 | 17.826 / 17.826 | 148,55 | 12 / 26 / 33 / 54 | 15 / 33 / 42 / 69 | 794 |

Em todos os patamares: nenhuma falha de login (inclusive 429), de sessão ou de CSRF, nenhum tempo limite e
nenhuma resposta 4xx ou 5xx no gateway. Containers saudáveis, sem reinício ou OOM; o worker não tem
healthcheck. Em 100 usuários há um POST a menos que interações: a última começou na janela e enviou o POST depois.

## Comparação com a Etapa 14

| Usuários | p95 do POST antes → depois | No prazo antes → depois | POST/s antes → depois | Pico de CPU Java (núcleos) antes → depois | Pico de RAM (MiB) antes → depois |
|---:|---|---|---|---|---|
| 10 | 453 → 18 ms | 100% → 100% | 3,58 → 4,99 | 3,08 → 0,28 | 946 → 910 |
| 50 | 4.339 → 16 ms | 15,88% → 100% | 6,51 → 24,77 | 7,72 → 0,94 | 999 → 966 |
| 100 | 8.156 → 16 ms | 0,25% → 100% | 6,77 → 49,61 | 7,73 → 1,79 | 1.071 → 1.005 |
| 200 | 16.505 → 21 ms | 0,14% → 100% | 5,87 → 99,36 | 7,93 → 3,50 | 1.187 → 1.099 |
| 300 | sem amostra válida → 33 ms | sem amostra válida → 100% | 0,02 → 148,55 | 7,72 → 5,25 | 1.258 → 1.198 |

Não há melhoria percentual em 300 usuários: a referência anterior não permite calcular latência. Os picos de CPU
consideram a execução inteira, como antes, e agora ocorrem na subida, com os logins.

### CPU dentro da janela medida (núcleos, média / pico)

| Usuários | Java | FastAPI | Gateway | PostgreSQL |
|---:|---|---|---|---|
| 10 | 0,08 / 0,12 | 0,07 / 0,07 | 0,02 / 0,03 | 0,03 / 0,04 |
| 50 | 0,19 / 0,23 | 0,15 / 0,18 | 0,06 / 0,10 | 0,04 / 0,09 |
| 100 | 0,26 / 0,29 | 0,22 / 0,23 | 0,10 / 0,11 | 0,04 / 0,04 |
| 200 | 0,44 / 0,51 | 0,40 / 0,43 | 0,16 / 0,19 | 0,05 / 0,06 |
| 300 | 0,61 / 0,65 | 0,57 / 0,62 | 0,51 / 0,91 | 0,07 / 0,08 |

São cerca de 13 amostras por janela, portanto picos curtos podem escapar.

## Condições

- Revisão `676ad62794af1f8e145ff0670deb61412d555b99`, árvore limpa; imagens em [imagens.txt](imagens.txt).
- Mac Intel i5 de 4 núcleos, 16 GB; Docker com 8 CPUs virtuais e 7,75 GiB, sem alteração; k6 1.8.2 no mesmo host.
- BCrypt custo 12, CSRF e consentimento ativos; `LOGIN_RATE=10r/s`, `LOGIN_BURST=50`; Ollama desligado.
- Volumes novos; 300 contas provisionadas em 101 s, fora da medição.
- O host tinha navegador e IDEs abertos (carga média 8,4 / 7,1 / 8,0 no início). Outra aplicação em container:
  apenas um PostgreSQL avulso, ocioso.

## Diferenças metodológicas

Sessão no lugar de HTTP Basic (BCrypt só no login), login durante a subida e fora da janela, cabeçalho de
contexto, `/api/csrf` pública, POST enviado mesmo que o CSRF termine após a janela e critério complementar por
interação. Mantidos: patamares, janelas, pausas de 1 a 3 s, notas, tempos limite, limites de segurança, GET de
CSRF antes de cada POST, hardware e recursos do Docker. Detalhes no
[roteiro](../../../integration-tests/carga/README.md).

## Limites da conclusão

- Uma rodada por patamar, com janela de 120 s; não há medida de variação entre rodadas nem teste de longa duração.
- A carga é de ciclo fechado: a vazão é limitada pelas pausas. **A capacidade máxima não foi medida.**
- Mede o regime com sessões estabelecidas. Os 300 logins foram distribuídos em 30 s; uma entrada em massa mais
  rápida esbarraria no limite do gateway e no custo do BCrypt.
- Ambiente local, uma instância por serviço, HTTP em loopback. Não representa produção.
- Sessões em memória impedem escalar o Java horizontalmente sem outra solução de sessão.

Dados: [JSON](rnf01.json) e [CSV](rnf01.csv). Referência anterior: [Etapa 14](../../evidencias-etapa14/README.md).
