import { useMemo, useState } from 'react'
import { Nome } from '../components/Nome'
import { Empty, Modal, shareOrCopy, StatBox, Stepper } from '../components/ui'
import { calcularForca } from '../lib/forca'
import { placarDosSets, setsParaVencer, unidade, vencedor } from '../lib/placar'
import { rankingDoDia, saldo } from '../lib/ranking'
import { maxRodadas, mesasAgora, montarPartidas } from '../lib/rodizio'
import { useStore } from '../lib/store'
import { dataCurta, hojeISO, jogada, plural, uid, type Partida, type Play } from '../lib/tipos'

export default function PlayPage({ onToast }: { onToast: (m: string) => void }) {
  const { dados, podeEditar } = useStore()
  const [aberto, setAberto] = useState<string | null>(() => dados.plays.find((p) => p.status === 'aberto')?.id ?? null)
  const [criando, setCriando] = useState(false)
  const play = dados.plays.find((p) => p.id === aberto)

  if (criando) {
    return (
      <CriarPlay
        onToast={onToast}
        onVoltar={() => setCriando(false)}
        onCriou={(id) => {
          setCriando(false)
          setAberto(id)
        }}
      />
    )
  }
  if (play) return <PlayAberto play={play} onToast={onToast} onVoltar={() => setAberto(null)} />

  const plays = [...dados.plays].sort((a, b) => b.data.localeCompare(a.data) || b.created_at.localeCompare(a.created_at))
  return (
    <div className="card">
      <div className="row spread">
        <div className="section-title" style={{ margin: 0 }}>🏓 Plays</div>
        {podeEditar && <button className="btn pink sm" onClick={() => setCriando(true)}>➕ Novo play</button>}
      </div>
      <div className="stack" style={{ marginTop: 12 }}>
        {plays.length === 0 && <Empty>{podeEditar ? 'Monte o primeiro play no botão acima.' : 'Nenhum play ainda.'}</Empty>}
        {plays.map((p) => {
          const ps = dados.partidas.filter((m) => m.play_id === p.id)
          return (
            <div key={p.id} className="row" style={{ borderBottom: '1px dashed var(--line)', paddingBottom: 10, cursor: 'pointer' }} onClick={() => setAberto(p.id)}>
              <div className="grow">
                <div className="row" style={{ gap: 8 }}>
                  <strong className="ellipsis">{p.titulo}</strong>
                  <span className={`badge ${p.status === 'aberto' ? 'open' : 'finished'}`}>{p.status === 'aberto' ? 'em andamento' : 'finalizado'}</span>
                  {!p.ranked && <span className="badge avulso">avulso</span>}
                </div>
                <div className="tiny muted">
                  {dataCurta(p.data)} · {plural(p.jogador_ids.length, 'jogador', 'jogadores')} · {ps.filter(jogada).length}/{ps.length} partidas
                </div>
              </div>
              <button className="btn ghost sm">Abrir</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- criar */

function CriarPlay({ onToast, onVoltar, onCriou }: { onToast: (m: string) => void; onVoltar: () => void; onCriou: (id: string) => void }) {
  const { dados, salvarPlay, salvarPartidas, nome } = useStore()
  const forca = useMemo(() => calcularForca(dados), [dados])
  const ativos = dados.jogadores.filter((j) => j.ativo).sort((a, b) => nome(a.id).localeCompare(nome(b.id)))
  const [sel, setSel] = useState<string[]>([])
  const [data, setData] = useState(hojeISO())
  const [titulo, setTitulo] = useState('')
  const [mesas, setMesas] = useState(1)
  const [melhorDe, setMelhorDe] = useState(3)
  const pontosSet = 11 // o set e sempre de 11, como no oficial
  const [rodadasEscolhidas, setRodadas] = useState<number | null>(null)
  const [ranked, setRanked] = useState(true)
  const max = maxRodadas(sel.length)
  const rodadas = Math.min(rodadasEscolhidas ?? max, max)
  const total = Math.floor(sel.length / 2) * rodadas
  // uns 12 min por partida de melhor de 3, 18 de melhor de 5, 6 de partida unica (por mesa)
  const minutos = Math.ceil(total / Math.max(1, Math.min(mesas, Math.floor(sel.length / 2)))) * (melhorDe * 4 + 2)

  const alternar = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  function criar() {
    if (sel.length < 2) return onToast('Escolha pelo menos 2 jogadores')
    const id = uid()
    // o mais forte primeiro: o circulo do rodizio parte da ordem, e assim as
    // primeiras rodadas ja misturam niveis
    const ordem = [...sel].sort((a, b) => forca.nota(b) - forca.nota(a))
    const play: Play = {
      id, data, titulo: titulo.trim() || 'Play de ping-pong', mesas, melhor_de: melhorDe, pontos_set: pontosSet,
      jogador_ids: ordem, status: 'aberto', ranked, created_at: new Date().toISOString(),
    }
    salvarPlay(play)
    salvarPartidas(montarPartidas(id, ordem, rodadas))
    onToast('Play criado 🏓')
    onCriou(id)
  }

  return (
    <>
      <div className="card">
        <div className="row spread">
          <div className="section-title" style={{ margin: 0 }}>➕ Novo play</div>
          <button className="btn ghost sm" onClick={onVoltar}>← Voltar</button>
        </div>
        <div className="row spread" style={{ marginTop: 12 }}>
          <strong className="small">Quem joga ({sel.length})</strong>
          <button className="btn ghost sm" onClick={() => setSel(sel.length === ativos.length ? [] : ativos.map((j) => j.id))}>
            {sel.length === ativos.length ? 'Nenhum' : 'Todos'}
          </button>
        </div>
        <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
          {ativos.length === 0 && <span className="tiny muted">Cadastre os jogadores na aba 👥 Jogadores.</span>}
          {ativos.map((j) => (
            <button key={j.id} type="button" className={`chip ${sel.includes(j.id) ? 'on' : ''}`} onClick={() => alternar(j.id)}>
              {nome(j.id)}
              {forca.jogos.has(j.id) && <span className="tiny" style={{ opacity: 0.7, marginLeft: 4 }}>{Math.round(forca.nota(j.id))}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="section-title">🎯 Placar</div>
        <div className="field">
          <span>Partida</span>
          <div className="segmented">
            {[3, 5, 7].map((n) => (
              <button key={n} className={melhorDe === n ? 'on' : ''} onClick={() => setMelhorDe(n)}>melhor de {n}</button>
            ))}
          </div>
          <em className="hint">
            Sets de 11 pontos (com 2 de vantagem no 10x10), como no ping-pong oficial. Ganha quem fechar{' '}
            {setsParaVencer(melhorDe)} sets; o placar é lançado em sets ({setsParaVencer(melhorDe)}x0, {setsParaVencer(melhorDe)}x1…).
            Com muita gente, melhor de 3 deixa a noite mais curta.
          </em>
        </div>
      </div>

      <div className="card">
        <div className="section-title">⚙️ Detalhes</div>
        <div className="stack">
          <label className="field">
            <span>Data</span>
            <input className="input" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className="field">
            <span>Nome do play</span>
            <input className="input" placeholder="Play de ping-pong" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </label>
          <div className="field">
            <span>Mesas</span>
            <Stepper value={mesas} min={1} max={8} onChange={setMesas} />
          </div>
          {sel.length >= 3 && (
            <div className="field">
              <span>Rodadas</span>
              <Stepper value={rodadas} min={1} max={max} onChange={setRodadas} />
              <em className="hint">
                {rodadas === max
                  ? `todos contra todos: cada um enfrenta cada um uma vez`
                  : `cada um joga ${sel.length % 2 === 0 ? rodadas : `${rodadas - 1} ou ${rodadas}`} partidas, não todas`}
                {` · ${plural(total, 'partida')} · uns ${minutos >= 60 ? `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, '0')}` : `${minutos} min`}`}
                {sel.length % 2 === 1 ? ' · com número ímpar, um folga em cada rodada' : ''}
              </em>
            </div>
          )}
          <label className={`toggle-card row${ranked ? '' : ' avulso'}`} style={{ gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={ranked} onChange={(e) => setRanked(e.target.checked)} />
            <span className="grow">
              <strong>{ranked ? '🏆 Vale para o ranking do mês' : '🎈 Play avulso'}</strong>
              <span className="hint" style={{ marginTop: 2 }}>
                {ranked
                  ? 'os pontos entram no ranking do mês; quem falta perde força a partir da 2ª falta seguida'
                  : 'não soma no ranking do mês e faltar não conta — mas entra na força e no histórico'}
              </span>
            </span>
          </label>
        </div>
      </div>

      <button className="btn pink block" disabled={sel.length < 2} onClick={criar}>
        🏓 Criar o play {sel.length >= 2 ? `(${plural(total || 1, 'partida')})` : ''}
      </button>
    </>
  )
}

/* ---------------------------------------------------------- play aberto */

function PlayAberto({ play, onToast, onVoltar }: { play: Play; onToast: (m: string) => void; onVoltar: () => void }) {
  const { dados, podeEditar, salvarPlay, salvarPartidas, apagarPartidas, apagarPlay, nome } = useStore()
  const partidas = useMemo(() => dados.partidas.filter((p) => p.play_id === play.id).sort((a, b) => a.ordem - b.ordem), [dados.partidas, play.id])
  const [lancando, setLancando] = useState<Partida | null>(null)
  const [apagando, setApagando] = useState(false)
  const editavel = podeEditar && play.status === 'aberto'
  const mesas = useMemo(() => mesasAgora(partidas, play.mesas), [partidas, play.mesas])
  const feitas = partidas.filter(jogada).sort((a, b) => (b.terminada_em ?? '').localeCompare(a.terminada_em ?? '') || b.ordem - a.ordem)
  const naMesa = new Set(mesas.map((m) => m.partida?.id))
  const fila = partidas.filter((p) => !jogada(p) && !p.iniciada_em && !naMesa.has(p.id))
  const ranking = useMemo(() => rankingDoDia(dados, play.id), [dados, play.id])
  const un = unidade(play.melhor_de)

  function iniciar(p: Partida, mesa: number) {
    salvarPartidas([{ ...p, mesa, iniciada_em: new Date().toISOString() }])
  }
  function voltarParaFila(p: Partida) {
    salvarPartidas([{ ...p, mesa: null, iniciada_em: null }])
  }
  function finalizar() {
    const sobrando = partidas.filter((p) => !jogada(p))
    if (sobrando.length > 0 && !confirm(`${plural(sobrando.length, 'partida não foi jogada', 'partidas não foram jogadas')} e ${sobrando.length === 1 ? 'sai' : 'saem'} do play. Finalizar mesmo assim?`)) return
    apagarPartidas(sobrando.map((p) => p.id))
    salvarPlay({ ...play, status: 'finalizado' })
    onToast('Play finalizado 🏁')
  }
  function textoDoDia(): string {
    const linhas = ranking.filter((r) => r.jogos > 0).map((r, i) => `${['🥇', '🥈', '🥉'][i] ?? `${i + 1}º`} ${nome(r.id)} — ${r.v}V ${r.d}D (saldo ${saldo(r) > 0 ? '+' : ''}${saldo(r)})`)
    return `🏓 *${play.titulo}* — ${dataCurta(play.data)}\n\n${linhas.join('\n')}`
  }

  return (
    <>
      <div className="card">
        <div className="row spread">
          <button className="btn ghost sm" onClick={onVoltar}>← Plays</button>
          <span className="row" style={{ gap: 6 }}>
            {!play.ranked && <span className="badge avulso">avulso</span>}
            <span className={`badge ${play.status === 'aberto' ? 'open' : 'finished'}`}>{play.status === 'aberto' ? 'em andamento' : 'finalizado'}</span>
          </span>
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, marginTop: 10 }}>{play.titulo}</div>
        <div className="small muted">
          {dataCurta(play.data)} · {plural(play.jogador_ids.length, 'jogador', 'jogadores')} ·{' '}
          melhor de {play.melhor_de} · sets de {play.pontos_set}
        </div>
        <div className="grid3" style={{ marginTop: 12 }}>
          <StatBox k="Partidas" v={`${feitas.length}/${partidas.length}`} />
          <StatBox k="Na mesa" v={mesas.filter((m) => m.emJogo).length} />
          <StatBox k="Líder" v={<span style={{ fontSize: 13 }}>{ranking[0]?.jogos ? nome(ranking[0].id) : '—'}</span>} />
        </div>
      </div>

      {play.status === 'aberto' && (
        <div className="card">
          <div className="row spread">
            <div className="section-title" style={{ margin: 0 }}>🏓 Mesas</div>
            {editavel && (
              <div className="row" style={{ gap: 6 }}>
                <button className="btn ghost sm" disabled={play.mesas <= 1 || mesas.some((m) => m.emJogo && m.mesa === play.mesas)} onClick={() => salvarPlay({ ...play, mesas: play.mesas - 1 })}>−</button>
                <span className="small">{plural(play.mesas, 'mesa')}</span>
                <button className="btn ghost sm" disabled={play.mesas >= 8} onClick={() => salvarPlay({ ...play, mesas: play.mesas + 1 })}>+</button>
              </div>
            )}
          </div>
          <div className="stack" style={{ marginTop: 12 }}>
            {mesas.map(({ mesa, partida: p, emJogo }) => (
              <div key={mesa + (p?.id ?? '')} className={`mesa${emJogo ? ' viva' : ''}`}>
                <div className="row spread">
                  <span className="mesa-nome">Mesa {mesa}</span>
                  <span className="tiny muted">{p ? (emJogo ? '🔴 jogando' : 'próxima') : ''}</span>
                </div>
                {p ? (
                  <>
                    <div className="duelo">
                      <span className="lado ellipsis"><Nome id={p.a} /></span>
                      <span className="vs">VS</span>
                      <span className="lado ellipsis"><Nome id={p.b} /></span>
                    </div>
                    {editavel &&
                      (emJogo ? (
                        <div className="row" style={{ gap: 8 }}>
                          <button className="btn pink grow" onClick={() => setLancando(p)}>🏁 Lançar placar</button>
                          <button className="btn ghost sm" onClick={() => voltarParaFila(p)} title="Não começou: volta para a fila">↩️</button>
                        </div>
                      ) : (
                        <button className="btn teal block" onClick={() => iniciar(p, mesa)}>▶️ Partida iniciada</button>
                      ))}
                  </>
                ) : (
                  <div className="tiny muted" style={{ marginTop: 6 }}>
                    {partidas.some((x) => !jogada(x)) ? 'Livre — quem falta jogar está em outra mesa.' : 'Livre — não falta ninguém.'}
                  </div>
                )}
              </div>
            ))}
          </div>
          {fila.length > 0 && (
            <>
              <div className="small" style={{ fontWeight: 800, margin: '14px 0 6px' }}>Na fila ({fila.length})</div>
              <div className="stack" style={{ gap: 4 }}>
                {fila.slice(0, 8).map((p) => (
                  <div key={p.id} className="small">
                    <span className="muted tabular" style={{ marginRight: 6 }}>R{p.rodada}</span>
                    {nome(p.a)} × {nome(p.b)}
                  </div>
                ))}
                {fila.length > 8 && <div className="tiny muted">e mais {fila.length - 8}</div>}
              </div>
              <p className="tiny muted" style={{ marginBottom: 0 }}>
                A mesa que vaga puxa a partida de quem está parado há mais tempo, com os dois livres.
              </p>
            </>
          )}
          {partidas.length > 0 && partidas.every(jogada) && editavel && (
            <button className="btn purple block" style={{ marginTop: 12 }} onClick={finalizar}>🏁 Finalizar o play</button>
          )}
        </div>
      )}

      <div className="card">
        <div className="row spread">
          <div className="section-title" style={{ margin: 0 }}>🏆 Ranking do dia</div>
          <button className="btn ghost sm" onClick={async () => onToast((await shareOrCopy(textoDoDia())) ? 'Resultado copiado 💬' : 'Não consegui copiar')}>💬 Enviar</button>
        </div>
        <table className="table tabular" style={{ marginTop: 8 }}>
          <thead>
            <tr><th>Jogador</th><th>V</th><th>D</th><th>Saldo</th><th>{un === 'sets' ? 'Sets' : 'Pts'}</th></tr>
          </thead>
          <tbody>
            {ranking.map((r, i) => (
              <tr key={r.id}>
                <td><span className="muted" style={{ marginRight: 6 }}>{['🥇', '🥈', '🥉'][i] ?? `${i + 1}º`}</span><Nome id={r.id} /></td>
                <td><strong>{r.v}</strong></td>
                <td>{r.d}</td>
                <td>{saldo(r) > 0 ? `+${saldo(r)}` : saldo(r)}</td>
                <td>{r.pro}–{r.contra}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tiny muted" style={{ marginBottom: 0 }}>O dia é por vitórias; o saldo de {un} desempata.</p>
      </div>

      {feitas.length > 0 && (
        <div className="card">
          <div className="section-title">✅ Já jogadas</div>
          <div className="stack" style={{ gap: 6 }}>
            {feitas.map((p) => {
              const v = vencedor(p)
              return (
                <div key={p.id} className="row small">
                  <span className="grow">
                    <span style={{ fontWeight: v === p.a ? 800 : 400 }}>{nome(p.a)}</span>
                    {' '}<strong className="tabular">{p.placar_a}x{p.placar_b}</strong>{' '}
                    <span style={{ fontWeight: v === p.b ? 800 : 400 }}>{nome(p.b)}</span>
                    {p.sets?.length ? <span className="tiny muted"> · {p.sets.map((x) => `${x[0]}-${x[1]}`).join(', ')}</span> : null}
                  </span>
                  {podeEditar && <button className="btn ghost sm" onClick={() => setLancando(p)}>✏️</button>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {podeEditar && (
        <div className="row" style={{ gap: 8 }}>
          {play.status === 'aberto' ? (
            !partidas.every(jogada) && <button className="btn ghost grow" onClick={finalizar}>🏁 Finalizar agora</button>
          ) : (
            <button className="btn ghost grow" onClick={() => salvarPlay({ ...play, status: 'aberto' })}>↩️ Reabrir</button>
          )}
          <button className="btn ghost grow" onClick={() => salvarPlay({ ...play, ranked: !play.ranked })}>
            {play.ranked ? '🎈 Tornar avulso' : '🏆 Valer para o mês'}
          </button>
          <button className="btn danger" onClick={() => setApagando(true)}>🗑</button>
        </div>
      )}

      {lancando && (
        <LancarPlacar
          play={play}
          partida={lancando}
          onClose={() => setLancando(null)}
          onSalvar={(sets) => {
            const { a, b } = placarDosSets(sets, play.melhor_de)
            salvarPartidas([{ ...lancando, sets, placar_a: a, placar_b: b, terminada_em: lancando.terminada_em ?? new Date().toISOString(), iniciada_em: lancando.iniciada_em ?? new Date().toISOString() }])
            setLancando(null)
            onToast(`${nome(a > b ? lancando.a : lancando.b)} venceu ${Math.max(a, b)}x${Math.min(a, b)} ✅`)
          }}
        />
      )}
      {apagando && (
        <ApagarPlay
          play={play}
          jogadas={feitas.length}
          onClose={() => setApagando(false)}
          onApagar={() => {
            apagarPlay(play.id)
            onToast('Play apagado')
            onVoltar()
          }}
        />
      )}
    </>
  )
}

/**
 * O PLACAR SET POR SET: em cada set, quem venceu e com quantos pontos (11x0 ...
 * 11x9, ou o deuce digitado). O placar da partida (3x1) sai dos sets, e os
 * pontos de cada set entram na forca.
 */
function LancarPlacar({ play, partida, onClose, onSalvar }: { play: Play; partida: Partida; onClose: () => void; onSalvar: (sets: [number, number][]) => void }) {
  const { nome } = useStore()
  const [sets, setSets] = useState<[number, number][]>(partida.sets ?? [])
  const [quem, setQuem] = useState<'a' | 'b' | null>(null)
  const [deuce, setDeuce] = useState(false)
  const [vDeuce, setVDeuce] = useState(12)
  const placar = placarDosSets(sets, play.melhor_de)
  const fechou = placar.completo
  const alvo = setsParaVencer(play.melhor_de)

  function anotar(v: number, p: number) {
    if (!quem) return
    setSets([...sets, quem === 'a' ? [v, p] : [p, v]])
    setQuem(null)
    setDeuce(false)
  }

  return (
    <Modal title={partida.placar_a !== null ? 'Corrigir placar' : 'Placar set a set'} onClose={onClose}>
      <div className="stack">
        <div className="duelo">
          <span className="lado ellipsis">{nome(partida.a)}</span>
          <span className="placar-grande">{placar.a}x{placar.b}</span>
          <span className="lado ellipsis">{nome(partida.b)}</span>
        </div>
        {sets.length > 0 && (
          <div className="stack" style={{ gap: 4 }}>
            {sets.map((st, i) => (
              <div key={i} className="row small">
                <span className="muted" style={{ width: 46 }}>Set {i + 1}</span>
                <strong className="grow tabular">{st[0]}x{st[1]} · {nome(st[0] > st[1] ? partida.a : partida.b)}</strong>
                {i === sets.length - 1 && <button className="btn ghost sm" onClick={() => setSets(sets.slice(0, -1))}>desfazer</button>}
              </div>
            ))}
          </div>
        )}

        {!fechou && (
          <>
            <div className="ask">Set {sets.length + 1}: quem venceu?</div>
            <div className="grid2">
              {(['a', 'b'] as const).map((l) => (
                <button key={l} className={`btn ${quem === l ? 'pink' : 'ghost'}`} onClick={() => { setQuem(l); setDeuce(false) }}>
                  {nome(partida[l])}
                </button>
              ))}
            </div>
            {quem && !deuce && (
              <>
                <div className="ask">Quantos pontos fez quem perdeu o set?</div>
                <div className="games-row">
                  {Array.from({ length: 10 }, (_, i) => (
                    <button key={i} className="game-btn" onClick={() => anotar(11, i)}>11x{i}</button>
                  ))}
                  <button className="game-btn" onClick={() => setDeuce(true)}>10x10 →</button>
                </div>
              </>
            )}
            {quem && deuce && (
              <div className="field">
                <span>Passou do 10x10: quantos fez quem venceu o set?</span>
                <Stepper value={vDeuce} min={12} max={40} onChange={setVDeuce} />
                <button className="btn pink block" style={{ marginTop: 8 }} onClick={() => anotar(vDeuce, vDeuce - 2)}>
                  Set {vDeuce}x{vDeuce - 2}
                </button>
              </div>
            )}
          </>
        )}

        {fechou ? (
          <button className="btn pink block" onClick={() => onSalvar(sets)}>
            ✅ Salvar {Math.max(placar.a, placar.b)}x{Math.min(placar.a, placar.b)} para {nome(placar.a > placar.b ? partida.a : partida.b)}
          </button>
        ) : (
          <p className="tiny muted" style={{ margin: 0 }}>
            Melhor de {play.melhor_de}: a partida fecha quando alguém fizer {alvo} sets. Os pontos de cada set entram na força.
          </p>
        )}
      </div>
    </Modal>
  )
}

function ApagarPlay({ play, jogadas, onClose, onApagar }: { play: Play; jogadas: number; onClose: () => void; onApagar: () => void }) {
  const [texto, setTexto] = useState('')
  return (
    <Modal title="Apagar este play?" onClose={onClose}>
      <div className="banner err" style={{ marginTop: 0 }}>
        <strong>{play.titulo}</strong> — {dataCurta(play.data)}
        <br />
        Isso apaga {plural(jogadas, 'partida já jogada', 'partidas já jogadas')} (sai do ranking e da força) e não tem como desfazer.
      </div>
      <label className="field">
        <span>Escreva APAGAR para confirmar</span>
        <input className="input" value={texto} onChange={(e) => setTexto(e.target.value.toUpperCase())} />
      </label>
      <button className="btn danger block" style={{ marginTop: 10 }} disabled={texto !== 'APAGAR'} onClick={onApagar}>🗑 Apagar</button>
    </Modal>
  )
}
