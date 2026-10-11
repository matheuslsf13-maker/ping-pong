import { useMemo, useState } from 'react'
import { Empty, Modal, Stepper } from '../components/ui'
import { calcularForca, FORCA_MEDIA } from '../lib/forca'
import { useStore } from '../lib/store'
import { uid, type Jogador } from '../lib/tipos'

/** Cadastro de quem joga (so para quem esta logada). */
export default function Jogadores({ onToast }: { onToast: (m: string) => void }) {
  const { dados, salvarJogador } = useStore()
  const [editando, setEditando] = useState<Jogador | null>(null)
  const [verInativos, setVerInativos] = useState(false)
  const forca = useMemo(() => calcularForca(dados), [dados])
  const lista = dados.jogadores
    .filter((j) => (verInativos ? !j.ativo : j.ativo))
    .sort((a, b) => (a.apelido || a.nome).localeCompare(b.apelido || b.nome))

  return (
    <>
      <div className="card">
        <div className="row spread">
          <div className="section-title" style={{ margin: 0 }}>👥 Jogadores</div>
          <button
            className="btn pink sm"
            onClick={() => setEditando({ id: uid(), nome: '', apelido: null, forca_inicial: null, ativo: true, created_at: new Date().toISOString() })}
          >
            ➕ Novo
          </button>
        </div>
        <div className="segmented" style={{ marginTop: 12 }}>
          <button className={!verInativos ? 'on' : ''} onClick={() => setVerInativos(false)}>Ativos</button>
          <button className={verInativos ? 'on' : ''} onClick={() => setVerInativos(true)}>Inativos</button>
        </div>
        <div className="stack" style={{ marginTop: 12, gap: 0 }}>
          {lista.length === 0 && <Empty icon="👥">{verInativos ? 'Ninguém inativo.' : 'Cadastre quem joga para montar o primeiro play.'}</Empty>}
          {lista.map((j) => (
            <div key={j.id} className="rank-row">
              <div className="grow">
                <strong>{j.apelido?.trim() || j.nome}</strong>
                <div className="tiny muted">
                  {j.apelido?.trim() ? `${j.nome} · ` : ''}
                  {forca.jogos.has(j.id)
                    ? `força ${Math.round(forca.nota(j.id))} · ${forca.jogos.get(j.id)} jogos`
                    : `ainda não jogou · começa com ${j.forca_inicial ?? FORCA_MEDIA}`}
                </div>
              </div>
              <button className="btn ghost sm" onClick={() => setEditando(j)}>✏️</button>
            </div>
          ))}
        </div>
      </div>
      {editando && (
        <EditarJogador
          jogador={editando}
          jaJogou={forca.jogos.has(editando.id)}
          onClose={() => setEditando(null)}
          onSalvar={(j) => {
            salvarJogador(j)
            setEditando(null)
            onToast(`${j.apelido?.trim() || j.nome} salvo ✅`)
          }}
        />
      )}
    </>
  )
}

function EditarJogador({
  jogador, jaJogou, onClose, onSalvar,
}: {
  jogador: Jogador
  jaJogou: boolean
  onClose: () => void
  onSalvar: (j: Jogador) => void
}) {
  const [nome, setNome] = useState(jogador.nome)
  const [apelido, setApelido] = useState(jogador.apelido ?? '')
  const [forca, setForca] = useState(jogador.forca_inicial ?? FORCA_MEDIA)
  return (
    <Modal title={jogador.nome ? 'Editar jogador' : 'Novo jogador'} onClose={onClose}>
      <div className="stack">
        <label className="field">
          <span>Nome</span>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Apelido (aparece no lugar do nome)</span>
          <input className="input" value={apelido} onChange={(e) => setApelido(e.target.value)} />
        </label>
        <div className="field">
          <span>Força inicial</span>
          <Stepper value={forca} min={1300} max={1700} onChange={setForca} />
          <em className="hint">
            1500 é o meio. Se já conhece o nível, comece mais alto ou mais baixo; depois as partidas mandam
            {jaJogou ? ' (mudar aqui recalcula o histórico a partir do novo ponto)' : ''}.
          </em>
        </div>
        <button
          className="btn pink block"
          disabled={!nome.trim()}
          onClick={() => onSalvar({ ...jogador, nome: nome.trim(), apelido: apelido.trim() || null, forca_inicial: forca })}
        >
          Salvar
        </button>
        {jogador.nome && (
          <button className="btn ghost block" onClick={() => onSalvar({ ...jogador, ativo: !jogador.ativo })}>
            {jogador.ativo ? '🚫 Inativar (some da hora de montar o play)' : '✅ Reativar'}
          </button>
        )}
      </div>
    </Modal>
  )
}
