import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  aplicar, carregar, enviar, faltaOScript, gravarCache, gravarFila, lerCache, lerFila, supabase, type Escrita,
} from '../data/banco'
import { dadosVazios, uid, type Dados, type Jogador, type Partida, type Play } from './tipos'

type DistribuiEscrita = Escrita extends infer E ? (E extends Escrita ? Omit<E, 'id'> : never) : never

type Store = {
  dados: Dados
  carregando: boolean
  erro: string | null
  /** As tabelas pp_ ainda nao existem: falta rodar o script no Supabase. */
  semTabelas: boolean
  email: string | null
  podeEditar: boolean
  pendentes: number
  enviando: boolean
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => Promise<void>
  salvarJogador: (j: Jogador) => void
  salvarPlay: (p: Play) => void
  apagarPlay: (id: string) => void
  salvarPartidas: (ps: Partida[]) => void
  apagarPartidas: (ids: string[]) => void
  nome: (id: string) => string
}

const Ctx = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fora do StoreProvider')
  return s
}

/**
 * OS DADOS DA TELA = o que veio do banco + as escritas ainda na fila. Cada
 * escrita aparece na hora (otimista), vai para a fila guardada no aparelho e
 * e enviada em ordem; sem sinal, fica la e sai sozinha quando o sinal volta.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [base, setBase] = useState<Dados>(() => lerCache() ?? dadosVazios())
  const [fila, setFila] = useState<Escrita[]>(() => lerFila())
  const [carregando, setCarregando] = useState(() => lerCache() === null)
  const [erro, setErro] = useState<string | null>(null)
  const [semTabelas, setSemTabelas] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const filaRef = useRef(fila)
  filaRef.current = fila

  const recarregar = useCallback(async () => {
    try {
      const d = await carregar()
      setBase(d)
      gravarCache(d)
      setErro(null)
      setSemTabelas(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (faltaOScript(msg)) {
        setSemTabelas(true)
        setErro(msg)
      } else if (!/fetch|network|Failed/i.test(msg)) setErro(`Não consegui ler o banco: ${msg}`)
    } finally {
      setCarregando(false)
    }
  }, [])

  // envia a fila, uma escrita por vez, na ordem
  const enviandoRef = useRef(false)
  const esvaziar = useCallback(async () => {
    if (enviandoRef.current) return
    enviandoRef.current = true
    setEnviando(true)
    try {
      while (filaRef.current.length > 0) {
        const e = filaRef.current[0]
        try {
          await enviar(e)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          // sem sinal: fica na fila e tenta de novo depois
          if (/fetch|network|Failed/i.test(msg)) break
          // so a leitura decide se faltam as tabelas; erro ao gravar mostra o texto
          // do banco e tenta de novo daqui a pouco (o intervalo e o "voltar ao app")
          setErro(`O banco não aceitou uma alteração (vou tentar de novo): ${msg}`)
          break
        }
        setBase((b) => aplicar(b, e))
        setErro(null)
        const resto = filaRef.current.slice(1)
        filaRef.current = resto
        setFila(resto)
        gravarFila(resto)
      }
    } finally {
      enviandoRef.current = false
      setEnviando(false)
    }
  }, [])

  useEffect(() => {
    void recarregar().then(() => void esvaziar())
    const t = window.setInterval(() => void esvaziar(), 15000)
    const online = () => void esvaziar()
    // ao voltar para o app: envia o que ficou e le de novo (o celular dormiu)
    const voltou = () => {
      if (document.visibilityState !== 'visible') return
      void esvaziar().then(() => {
        if (filaRef.current.length === 0) void recarregar()
      })
    }
    window.addEventListener('online', online)
    document.addEventListener('visibilitychange', voltou)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('online', online)
      document.removeEventListener('visibilitychange', voltou)
    }
  }, [recarregar, esvaziar])

  // o que outro celular mudou chega sozinho (quando nao ha nada daqui na fila)
  useEffect(() => {
    if (!supabase) return
    let espera: number | undefined
    const canal = supabase
      .channel('ping-pong')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_partidas' }, () => agendar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_plays' }, () => agendar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_jogadores' }, () => agendar())
      .subscribe()
    function agendar() {
      window.clearTimeout(espera)
      espera = window.setTimeout(() => {
        if (filaRef.current.length === 0) void recarregar()
      }, 600)
    }
    return () => {
      window.clearTimeout(espera)
      void supabase?.removeChannel(canal)
    }
  }, [recarregar])

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  const escrever = useCallback(
    (e: DistribuiEscrita) => {
      const op = { ...e, id: uid() } as Escrita
      const nova = [...filaRef.current, op]
      filaRef.current = nova
      setFila(nova)
      gravarFila(nova)
      void esvaziar()
    },
    [esvaziar],
  )

  const dados = useMemo(() => fila.reduce(aplicar, base), [base, fila])
  const nomes = useMemo(() => new Map(dados.jogadores.map((j) => [j.id, j.apelido?.trim() || j.nome])), [dados.jogadores])

  const valor: Store = {
    dados,
    carregando,
    erro,
    semTabelas,
    email,
    podeEditar: email !== null,
    pendentes: fila.length,
    enviando,
    entrar: async (e, senha) => {
      if (!supabase) throw new Error('Supabase não configurado')
      const { error } = await supabase.auth.signInWithPassword({ email: e, password: senha })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou senha errados' : error.message)
      void esvaziar()
    },
    sair: async () => {
      await supabase?.auth.signOut()
    },
    salvarJogador: (jogador) => escrever({ tipo: 'jogador', jogador }),
    salvarPlay: (play) => escrever({ tipo: 'play', play }),
    apagarPlay: (playId) => escrever({ tipo: 'apagarPlay', playId }),
    salvarPartidas: (partidas) => partidas.length > 0 && escrever({ tipo: 'partidas', partidas }),
    apagarPartidas: (ids) => ids.length > 0 && escrever({ tipo: 'apagarPartidas', ids }),
    nome: (id) => nomes.get(id) ?? '?',
  }
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}
