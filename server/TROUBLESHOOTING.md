# Troubleshooting - Conexão com Banco de Dados SAP Business One

## Erro: "Driver ODBC 'B1CRHPROXY' não encontrado"

### Solução:
1. Verifique se o SAP Business One Client está instalado no servidor
2. O driver ODBC `B1CRHPROXY` deve estar instalado e configurado
3. Para verificar drivers ODBC instalados no Windows:
   - Abra "Ferramentas Administrativas" > "Fontes de Dados ODBC (64 bits)"
   - Verifique se o driver "SAP Business One Client Proxy Driver" está listado

## Erro: "Não foi possível conectar ao servidor"

### Solução:
1. Verifique se o servidor SAP Business One está rodando
2. Teste a conectividade de rede:
   ```powershell
   Test-NetConnection -ComputerName petruzh -Port 30015
   ```
3. Verifique se o firewall não está bloqueando a porta 30015
4. Confirme o endereço do servidor em `server/config/database.js`

## Erro: "Erro de autenticação"

### Solução:
1. Verifique as credenciais em `server/config/database.js`:
   - Usuário: `B1ADMIN`
   - Senha: `@uP7bNatq2Xcm5`
2. Teste as credenciais usando o SAP Business One Client
3. Verifique se o usuário tem permissões de leitura no banco

## Erro: "Banco de dados não encontrado"

### Solução:
1. Verifique se o banco `SBO_PETRUZ_BR_TST` existe
2. Confirme o nome do banco em `server/config/database.js`
3. Verifique se o banco está acessível através do SAP Business One Client

## Verificação de String de Conexão

A string de conexão atual é:
```
DRIVER={B1CRHPROXY};SERVERNODE=petruzh:30015;DATABASE=SBO_PETRUZ_BR_TST;UID=B1ADMIN;PWD=@uP7bNatq2Xcm5
```

### Componentes:
- **DRIVER**: `{B1CRHPROXY}` - Driver ODBC do SAP Business One
- **SERVERNODE**: `petruzh:30015` - Servidor e porta do SAP
- **DATABASE**: `SBO_PETRUZ_BR_TST` - Nome do banco de dados
- **UID**: `B1ADMIN` - Usuário
- **PWD**: `@uP7bNatq2Xcm5` - Senha

## Teste Manual de Conexão

Para testar a conexão manualmente, você pode usar o SAP Business One Client ou criar um DSN ODBC de teste.

### Criar DSN de Teste (Windows):
1. Abra "Fontes de Dados ODBC (64 bits)"
2. Clique em "Adicionar"
3. Selecione "SAP Business One Client Proxy Driver"
4. Configure:
   - Server: `petruzh:30015`
   - Database: `SBO_PETRUZ_BR_TST`
   - User: `B1ADMIN`
   - Password: `@uP7bNatq2Xcm5`
5. Clique em "Test Connection"

## Logs do Servidor

Os logs do servidor mostrarão mensagens detalhadas sobre erros de conexão. Verifique o console onde o servidor está rodando para mais informações.

## Próximos Passos

Se nenhuma das soluções acima funcionar:
1. Verifique os logs do servidor SAP Business One
2. Entre em contato com o administrador do banco de dados
3. Verifique se há restrições de rede ou firewall
4. Confirme se o driver ODBC está na versão correta e compatível
