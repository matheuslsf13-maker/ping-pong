import { useMemo, useState } from 'react'
import GraficoDeForca from '../components/GraficoDeForca'
import { Nome } from '../components/Nome'
import { Empty, StatBox } from '../components/ui'
import { calcularForca, JOGOS_PARA_FIRMAR, nivelDeForca, rankingDeForca } from '../lib/forca'
import { confrontos, estatisticas } from '../lib/ranking'
import { useStore } from '../lib/store'
import { dataCurta, jogada, plural } from '../lib/tipos'

export default function Stats({ escolhido, onEscolher }: { escolhido: string | null; onEscolher: (id: string) => void }) {
  const { dados, nome } = useStore()
  const [aba, setAba] = useState<'jogador' | 'forca'>('jogador')
  const forcas = useMemo(() => rankingDeForca(dados), [dados])
  const id = escolhido ?? forcas[0]?.id ?? null

  return (
    <>
      <div className="card">
        <div className="segmented">
          <button className={aba === 'jogador' ? 'on' : ''} onClick={() => setAba('jogador')}>👤 Jogador</button>
          <button className={aba === 'forca' ? 'on' : ''} onClick={() => setAba('forca')}>💪 Força</button>
        </div>
        {aba === 'jogador' && (
          <select className="select" style={{ marginTop: 12, width: '100%' }} value={id ?? ''} onChange={(e) => onEscolher(e.target.value)}>
            {!id && <option value="">Escolha um jogador</option>}
            {[...dados.jogadores].sort((a, b) => nome(a.id).localeCompare(nome(b.id))).map((j) => (
              <option key={j.id} value={j.id}>{nome(j.id)}</option>
            ))}
          </select>
        )}
      </div>
      {aba === 'forca' ? <ListaDeForca /> : id ? <Ficha id={id} /> : <div className="card"><Empty>Ninguém jogou ainda.</Empty></div>}
    </>
  )
}

function ListaDeForca() {
  const { dados } = useStore()
  const linhas = useMemo(() => rankingDeForca(dados), [dados])
  if (linhas.length === 0) return <div className="card"><Empty>Ninguém jogou ainda.</Empty></div>
  return (
    <div className="card">
      <div className="section-title">💪 Força</div>
      {linhas.map((l, i) => {
        const n = nivelDeForca(l.nota)
        return (
          <div key={l.id} className="rank-row">
            <span className="rank-pos">{i + 1}</span>
            <div className="grow">
              <Nome id={l.id} />
              <div className="tiny muted">
                {n.emoji} {n.titulo} · {plural(l.jogos, 'jogo')}{l.provisoria ? ' · provisória' : ''}
                {l.queda && l.queda.faltas >= 2 ? ` · −${Math.round(l.queda.perda)} por ${l.queda.faltas} faltas seguidas` : ''}
              </div>
            </div>
            <strong className="tabular" style={{ fontSize: 17 }}>{l.nota}</strong>
          </div>
        )
      })}
      <p className="tiny muted" style={{ marginBottom: 0 }}>
        A força atravessa o ano e mede <strong>de quem</strong> você ganhou: vencer quem está melhor rende mais. 1500 é a média.
        Abaixo de {JOGOS_PARA_FIRMAR} jogos a nota é provisória.
      </p>
    </div>
  )
}

function Ficha({ id }: { id: string }) {
  const { dados, nome } = useStore()
  const f = useMemo(() => calcularForca(dados), [dados])
  const e = useMemo(() => estatisticas(dados.partidas).get(id), [dados.partidas, id])
  const rivais = useMemo(() => confrontos(dados, id), [dados, id])
  const minhas = dados.partidas
    .filter((p) => jogada(p) && (p.a === id || p.b === id))
    .sort((a, b) => (b.terminada_em ?? '').localeCompare(a.terminada_em ?? ''))
  const dataDoPlay = new Map(dados.plays.map((p) => [p.id, p.data]))
  // sequencia atual: vitorias (ou derrotas) seguidas ate a ultima partida
  let seq = 0
  for (const p of minhas) {
    const venceu = p.a === id ? (p.placar_a as number) > (p.placar_b as number) : (p.placar_b as number) > (p.placar_a as number)
    if (seq === 0) seq = venceu ? 1 : -1
    else if (venceu === seq > 0) seq += seq > 0 ? 1 : -1
    else break
  }
  const nota = Math.round(f.nota(id))
  const nivel = nivelDeForca(nota)
  const jogos = f.jogos.get(id) ?? 0
  const queda = f.queda.get(id)

  return (
    <>
      <div className="card">
        <div className="row spread">
          <div>
            <div style={{ fontSize: 19, fontWeight: 800 }}>{nome(id)}</div>
            <div className="tiny muted">
              {nivel.emoji} {nivel.titulo}
              {jogos < JOGOS_PARA_FIRMAR ? ' · provisória' : ''}
              {queda && queda.faltas >= 2 ? ` · −${Math.round(queda.perda)} por ${queda.faltas} faltas seguidas` : ''}
            </div>
          </div>
          <span style={{ fontSize: 24, fontWeight: 800 }} className="tabular">{jogos ? nota : '—'}</span>
        </div>
        {jogos > 0 && <GraficoDeForca dados={dados} id={id} />}
      </div>

      {e ? (
        <div className="card">
          <div className="grid3">
            <StatBox k="Jogos" v={e.jogos} />
            <StatBox k="V–D" v={`${e.v}–${e.d}`} />
            <StatBox k="Aproveit." v={`${Math.round((100 * e.v) / e.jogos)}%`} />
          </div>
          <div className="grid3" style={{ marginTop: 8 }}>
            <StatBox k="Pró" v={e.pro} />
            <StatBox k="Contra" v={e.contra} />
            <StatBox k="Sequência" v={seq > 0 ? `${seq}V` : seq < 0 ? `${-seq}D` : '—'} />
          </div>
        </div>
      ) : (
        <div className="card"><Empty>Ainda não jogou.</Empty></div>
      )}

      {rivais.length > 0 && (
        <div className="card">
          <div className="section-title">⚔️ Contra cada um</div>
          {rivais.map((r) => (
            <div key={r.id} className="rank-row">
              <div className="grow"><Nome id={r.id} /></div>
              <span className="tabular small">
                <strong style={{ color: r.v > r.d ? 'var(--verde)' : r.v < r.d ? 'var(--danger)' : undefined }}>{r.v}–{r.d}</strong>
              </span>
            </div>
          ))}
        </div>
      )}

      {minhas.length > 0 && (
        <div className="card">
          <div className="section-title">🕑 Últimas partidas</div>
          <div className="stack" style={{ gap: 6 }}>
            {minhas.slice(0, 12).map((p) => {
              const eu = p.a === id
              const meu = (eu ? p.placar_a : p.placar_b) as number
              const dele = (eu ? p.placar_b : p.placar_a) as number
              return (
                <div key={p.id} className="row small">
                  <span className="muted tabular">{dataCurta(dataDoPlay.get(p.play_id) ?? '')}</span>
                  <span className="grow">{meu > dele ? '✅' : '❌'} contra <Nome id={eu ? p.b : p.a} /></span>
                  <strong className="tabular">{meu}x{dele}</strong>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
