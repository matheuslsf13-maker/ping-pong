import { useMemo, useState } from 'react'
import { FORCA_MEDIA, historicoDeForca } from '../lib/forca'
import { estatisticas } from '../lib/ranking'
import { dataCurta, type Dados } from '../lib/tipos'

/**
 * A FORCA DO JOGADOR AO LONGO DO TEMPO (o mesmo grafico do Play de Todas): um
 * ponto cheio por play jogado, um vazado por falta que baixou a nota.
 */
export default function GraficoDeForca({ dados, id }: { dados: Dados; id: string }) {
  const pontos = useMemo(() => historicoDeForca(dados, id), [dados, id])
  const [tocado, setTocado] = useState<number | null>(null)
  const jogados = pontos.filter((p) => p.jogou)
  if (jogados.length === 0 || pontos.length < 3) {
    return <p className="tiny muted" style={{ margin: '10px 0 0' }}>O gráfico aparece a partir do 2º play (ou quando uma falta baixar a nota).</p>
  }

  const atras = jogados[Math.max(0, jogados.length - 6)]
  const agora = pontos[pontos.length - 1]
  const dif = agora.nota - atras.nota
  const nPlays = Math.min(5, jogados.length - 1)
  const periodo = nPlays === 0 ? 'desde o único play' : nPlays === 1 ? 'no último play' : `nos últimos ${nPlays} plays`
  const tendencia = Math.abs(dif) < 8 ? 'estável' : dif > 0 ? 'subindo' : 'descendo'

  const W = 320
  const H = 150
  const esq = 34
  const dir = 10
  const topo = 10
  const base = 22
  const notas = [...pontos.map((p) => p.nota), FORCA_MEDIA]
  const min = Math.min(...notas) - 10
  const max = Math.max(...notas) + 10
  const x = (i: number) => esq + (i * (W - esq - dir)) / (pontos.length - 1)
  const y = (v: number) => topo + ((max - v) * (H - topo - base)) / Math.max(1, max - min)
  const marcas = [...new Set([Math.ceil(min / 10) * 10, FORCA_MEDIA, Math.floor(max / 10) * 10])].sort((a, b) => a - b)
  const sel = tocado !== null ? pontos[tocado] : null
  const resumo = sel?.jogou ? resumoDoPlay(dados, sel.playId, id) : ''

  return (
    <div style={{ marginTop: 12 }}>
      <div className="row spread" style={{ alignItems: 'baseline' }}>
        <strong className="small">📈 Desempenho</strong>
        <span className="tiny" style={{ fontWeight: 800, color: tendencia === 'subindo' ? 'var(--verde)' : tendencia === 'descendo' ? 'var(--danger)' : 'var(--muted)' }}>
          {dif > 0 ? `+${dif}` : dif} {periodo} · {tendencia}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Força: de ${pontos[0].nota} para ${agora.nota}`} style={{ display: 'block', marginTop: 6, overflow: 'visible' }}>
        {marcas.map((v) => (
          <g key={v}>
            <line x1={esq} x2={W - dir} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray={v === FORCA_MEDIA ? '4 3' : undefined} />
            <text x={esq - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="var(--muted)">{v}</text>
          </g>
        ))}
        {pontos.slice(1).map((p, i) => (
          <line key={p.playId + i} x1={x(i)} y1={y(pontos[i].nota)} x2={x(i + 1)} y2={y(p.nota)} stroke="var(--marca)" strokeWidth={2} strokeDasharray={p.jogou ? undefined : '3 3'} strokeLinecap="round" />
        ))}
        {pontos.map((p, i) => (
          <circle
            key={p.playId + 'c' + i}
            cx={x(i)} cy={y(p.nota)} r={tocado === i ? 6 : 4}
            fill={p.playId === 'inicio' ? 'var(--muted)' : p.jogou ? 'var(--marca)' : 'var(--card)'}
            stroke={p.playId === 'inicio' ? 'var(--muted)' : 'var(--marca)'} strokeWidth={2}
            style={{ cursor: 'pointer' }} onClick={() => setTocado(tocado === i ? null : i)}
          />
        ))}
        <text x={esq} y={H - 6} fontSize="9" fill="var(--muted)">{dataCurta(pontos[0].data)}</text>
        <text x={W - dir} y={H - 6} textAnchor="end" fontSize="9" fill="var(--muted)">{dataCurta(agora.data)}</text>
      </svg>
      <p className="tiny muted" style={{ margin: '4px 0 0' }}>
        {sel
          ? sel.playId === 'inicio'
            ? `Ponto de partida: ${sel.nota}.`
            : sel.jogou
              ? `${dataCurta(sel.data)}: terminou o play com ${sel.nota}${resumo ? ` · ${resumo}` : ''}.`
              : `${dataCurta(sel.data)}: faltou, e a nota caiu para ${sel.nota}.`
          : 'Cada ponto cheio é um play; o vazado, uma falta que baixou a nota. Toque num ponto para ver o dia.'}
      </p>
    </div>
  )
}

function resumoDoPlay(dados: Dados, playId: string, id: string): string {
  const e = estatisticas(dados.partidas.filter((p) => p.play_id === playId)).get(id)
  return e ? `${e.v}V ${e.d}D` : ''
}
