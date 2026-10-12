/** As tabelas ainda nao existem no banco (o script 01 nao foi rodado). */
export function faltaOScript(msg: string): boolean {
  // so a TABELA que falta (nao uma coluna, nem um erro passageiro do cache do banco)
  return /(relation "?public\.pp_\w+"? does not exist|Could not find the table 'public\.pp_\w+')/i.test(msg)
}
