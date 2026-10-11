import { useMemo, useState } from 'react'
import { Nome } from '../components/Nome'
import { Empty, StatBox } from '../components/ui'
import { mesesComPlay, rankingDoMes, saldo } from '../lib/ranking'
import { useStore } from '../lib/store'
import { hojeISO, mesDe, nomeDoMes } from '../lib/tipos'

/** O ranking do mes (por pontos) e o historico de tudo. */
export default function Ranking() {
  const { dados } = useStore()
  const meses = useMemo(() => mesesComPlay(dados), [dados])
  const [escolhido, setEscolhido] = useState<string | null>(null)
  // sem escolha: o mes de hoje, ou o ultimo que teve play
  const mes = escolhido === 'tudo' ? null : escolhido ?? (meses.includes(mesDe(hojeISO())) ? mesDe(hojeISO()) : meses[0] ?? mesDe(hojeISO()))
  const linhas = useMemo(() => rankingDoMes(dados, mes), [dados, mes])
  const plays = dados.plays.filter((p) => p.ranked && (mes === null || mesDe(p.data) === mes))
  const partidas = linhas.reduce((t, l) => t + l.jogos, 0) / 2
  const podio = linhas.slice(0, 3)

  return (
    <>
      <div className="card">
        <div className="section-title">🏆 Ranking {mes ? `de ${nomeDoMes(mes)}` : '— todos os meses'}</div>
        <div className="chips-scroll" style={{ marginBottom: 12 }}>
          {meses.map((m) => (
            <button key={m} className={`round-chip${mes === m ? ' on' : ''}`} onClick={() => setEscolhido(m)}>
              {nomeDoMes(m).replace(' de ', '/').slice(0, 3)}/{m.slice(2, 4)}
            </button>
          ))}
          <button className={`round-chip${mes === null ? ' on' : ''}`} onClick={() => setEscolhido('tudo')}>Tudo</button>
        </div>

        {linhas.length === 0 ? (
          <Empty icon="🏓">Nenhuma partida que vale para o ranking {mes ? 'neste mês' : 'ainda'}.</Empty>
        ) : (
          <>
            <div className="podium">
              {[1, 0, 2].map((i) => {
                const l = podio[i]
                if (!l) return <div key={i} />
                return (
                  <div className={`slot p${i + 1}`} key={l.id}>
                    <div style={{ fontSize: i === 0 ? 34 : 26 }}>{['🥇', '🥈', '🥉'][i]}</div>
                    <div className="nm ellipsis"><Nome id={l.id} /></div>
                    <div className="base">
                      <div className="pos">{i + 1}º</div>
                      <div className="pts">{l.pontos} pts</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="grid3" style={{ marginTop: 14 }}>
              <StatBox k="Plays" v={plays.length} />
              <StatBox k="Partidas" v={partidas} />
              <StatBox k="Jogadores" v={linhas.length} />
            </div>
          </>
        )}
      </div>

      {linhas.length > 0 && (
        <div className="card">
          <div className="scroll-x">
            <table className="table tabular">
              <thead>
                <tr>
                  <th>Jogador</th>
                  <th>Pts</th>
                  <th>V</th>
                  <th>D</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={l.id}>
                    <td>
                      <span className="muted" style={{ marginRight: 6 }}>{i + 1}º</span>
                      <Nome id={l.id} />
                    </td>
                    <td><strong style={{ color: 'var(--pink)' }}>{l.pontos}</strong></td>
                    <td>{l.v}</td>
                    <td>{l.d}</td>
                    <td>{saldo(l) > 0 ? `+${saldo(l)}` : saldo(l)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted" style={{ marginBottom: 0 }}>
            Quem vence leva os sets que fez menos os do adversário (mínimo 1): 3x0 vale 3, 3x2 vale 1.
            Quem perde não pontua. Play avulso não entra. Toque num nome para ver a ficha.
          </p>
        </div>
      )}
    </>
  )
}
