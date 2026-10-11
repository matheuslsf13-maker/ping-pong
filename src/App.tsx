import { useCallback, useEffect, useState } from 'react'
import { AbrirPerfil } from './components/Nome'
import { Modal, Toast, useToast } from './components/ui'
import { useStore } from './lib/store'
import { aplicarTema, temaSalvo, type Tema } from './lib/tema'
import Jogadores from './pages/Jogadores'
import PlayPage from './pages/Play'
import Ranking from './pages/Ranking'
import Stats from './pages/Stats'

type Aba = 'ranking' | 'play' | 'stats' | 'jogadores'

const ABAS: { id: Aba; label: string; icon: string; soAdmin?: boolean }[] = [
  { id: 'ranking', label: 'Ranking', icon: '🏆' },
  { id: 'play', label: 'Play', icon: '🏓' },
  { id: 'stats', label: 'Stats', icon: '📊' },
  { id: 'jogadores', label: 'Jogadores', icon: '👥', soAdmin: true },
]

const CHAVE_DA_ABA = 'ping-pong:aba'

function abaSalva(): Aba {
  try {
    const v = localStorage.getItem(CHAVE_DA_ABA)
    if (v && ABAS.some((a) => a.id === v)) return v as Aba
  } catch {
    /* comeca no ranking */
  }
  return 'ranking'
}

export default function App() {
  const { carregando, erro, semTabelas, email, podeEditar, pendentes, enviando, entrar, sair } = useStore()
  const [aba, setAba] = useState<Aba>(abaSalva)
  const [perfil, setPerfil] = useState<string | null>(null)
  const [login, setLogin] = useState(false)
  const [tema, setTema] = useState<Tema>(() => temaSalvo())
  const { msg, show } = useToast()
  const abas = ABAS.filter((a) => !a.soAdmin || podeEditar)
  const visivel: Aba = abas.some((a) => a.id === aba) ? aba : 'ranking'

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_DA_ABA, aba)
    } catch {
      /* paciencia */
    }
    window.scrollTo(0, 0)
  }, [aba])

  const abrirPerfil = useCallback((id: string) => {
    setPerfil(id)
    setAba('stats')
  }, [])

  return (
    <AbrirPerfil.Provider value={abrirPerfil}>
      <div className="app">
        <header className="topbar">
          <div className="row spread">
            <span style={{ fontSize: 38, lineHeight: 1 }} aria-hidden>🏓</span>
            <div className="grow">
              <h1>Ping<span>-Pong</span></h1>
              <div className="sub">
                <span>1 contra 1</span>
                {podeEditar ? (
                  <span className={`sync ${pendentes > 0 ? (enviando ? 'saving' : 'pending') : 'saved'}`}>
                    <span className="dot" />
                    {pendentes === 0 ? 'tudo salvo' : enviando ? 'salvando…' : `${pendentes} para enviar`}
                  </span>
                ) : (
                  <span>só leitura</span>
                )}
              </div>
            </div>
            <button
              className="bt-tema"
              onClick={() => {
                const novo: Tema = tema === 'escuro' ? 'claro' : 'escuro'
                aplicarTema(novo)
                setTema(novo)
              }}
              aria-label={tema === 'escuro' ? 'Mudar para o modo diurno' : 'Mudar para o modo noturno'}
            >
              {tema === 'escuro' ? '☀️' : '🌙'}
            </button>
            {email ? (
              <button className="btn ghost sm" onClick={() => void sair()}>Sair</button>
            ) : (
              <button className="btn pink sm" onClick={() => setLogin(true)}>Entrar</button>
            )}
          </div>
        </header>

        {semTabelas && (
          <div className="banner err">
            O banco ainda não tem as tabelas do ping-pong. Rode o script <strong>supabase/01-ping-pong.sql</strong> no
            SQL Editor do Supabase (o mesmo projeto do Play de Todas) e recarregue.
          </div>
        )}
        {erro && !semTabelas && <div className="banner err">{erro}</div>}
        {pendentes > 0 && !enviando && (
          <div className="banner warn">
            📶 {pendentes === 1 ? '1 alteração guardada' : `${pendentes} alterações guardadas`} no celular. Pode continuar
            lançando: assim que o sinal voltar, eu envio.
          </div>
        )}

        {carregando ? (
          <div className="card"><div className="empty">Carregando…</div></div>
        ) : (
          <main>
            {visivel === 'ranking' && <Ranking />}
            {visivel === 'play' && <PlayPage onToast={show} />}
            {visivel === 'stats' && <Stats escolhido={perfil} onEscolher={setPerfil} />}
            {visivel === 'jogadores' && <Jogadores onToast={show} />}
          </main>
        )}

        <p className="versao">
          versão {__VERSAO__}
          {' · '}
          <button
            className="linkish"
            onClick={async () => {
              if ('serviceWorker' in navigator) {
                const rs = await navigator.serviceWorker.getRegistrations()
                await Promise.all(rs.map((r) => r.unregister()))
              }
              if (window.caches) {
                const ks = await caches.keys()
                await Promise.all(ks.map((k) => caches.delete(k)))
              }
              location.reload()
            }}
          >
            forçar atualização
          </button>
        </p>

        <nav className="tabbar">
          {abas.map((a) => (
            <button key={a.id} className={visivel === a.id ? 'active' : ''} onClick={() => setAba(a.id)}>
              <span className="ic">{a.icon}</span>
              {a.label}
            </button>
          ))}
        </nav>

        {login && (
          <Login
            onClose={() => setLogin(false)}
            entrar={async (e, s) => {
              await entrar(e, s)
              setLogin(false)
              show('Bem-vindo! 🏓')
            }}
          />
        )}
        <Toast message={msg} />
      </div>
    </AbrirPerfil.Provider>
  )
}

function Login({ onClose, entrar }: { onClose: () => void; entrar: (email: string, senha: string) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function ir() {
    setBusy(true)
    setErro(null)
    try {
      await entrar(email.trim(), senha)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui entrar')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title="Entrar para organizar" onClose={onClose}>
      <div className="stack">
        <label className="field">
          <span>E-mail</span>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Senha</span>
          <input
            className="input" type="password" autoComplete="current-password" value={senha}
            onChange={(e) => setSenha(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void ir()}
          />
        </label>
        {erro && <div className="banner err" style={{ margin: 0 }}>{erro}</div>}
        <button className="btn pink block" disabled={busy || !email || !senha} onClick={() => void ir()}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="tiny muted" style={{ margin: 0 }}>
          É o mesmo login do Play de Todas. Quem só quer ver o ranking não precisa entrar.
        </p>
      </div>
    </Modal>
  )
}
