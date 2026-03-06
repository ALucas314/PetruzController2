# Como Verificar o Nome Correto do Banco de Dados

## Problema
O erro "Banco de dados 'SBO_PETRUZ_BR_TST' não encontrado ou inacessível" indica que o nome do banco pode estar incorreto ou o formato da string de conexão precisa de ajustes.

## Soluções

### 1. Verificar o Nome do Banco no SAP Business One Client

1. Abra o SAP Business One Client
2. Faça login com as credenciais: `B1ADMIN` / `@uP7bNatq2Xcm5`
3. Vá em **Sistema** > **Administração** > **Seleção de Empresa**
4. Anote o nome exato do banco de dados listado

### 2. Testar Diferentes Formatos

O SAP Business One pode usar diferentes formatos para o nome do banco. Teste estas variações em `server/config/database.js`:

```javascript
// Opção 1: Original (com underscores e maiúsculas)
DATABASE=SBO_PETRUZ_BR_TST

// Opção 2: Tudo maiúsculo sem underscores
DATABASE=SBOPETRUZBRTST

// Opção 3: Minúsculas
DATABASE=sbo_petruz_br_tst

// Opção 4: Primeira letra maiúscula
DATABASE=Sbo_Petruz_Br_Tst
```

### 3. Usar a Rota de Teste

Acesse no navegador ou via curl:
```
http://localhost:3001/api/test-connection
```

Isso testará automaticamente diferentes formatos de conexão e mostrará qual funciona.

### 4. Verificar no SQL Server Management Studio

Se você tiver acesso ao SQL Server Management Studio:

1. Conecte ao servidor `petruzh:30015`
2. Execute:
   ```sql
   SELECT name FROM sys.databases WHERE name LIKE '%PETRUZ%'
   ```
3. Isso listará todos os bancos que contêm "PETRUZ" no nome

### 5. Verificar String de Conexão Completa

A string de conexão atual é:
```
DRIVER={B1CRHPROXY};SERVERNODE=petruzh:30015;DATABASE=SBO_PETRUZ_BR_TST;UID=B1ADMIN;PWD=@uP7bNatq2Xcm5
```

### 6. Testar sem Especificar o Banco

Algumas vezes, é possível conectar ao servidor sem especificar o banco e depois selecioná-lo. Tente:

```javascript
// Em server/config/database.js, temporariamente remova DATABASE:
connectionString: "DRIVER={B1CRHPROXY};SERVERNODE=petruzh:30015"
```

### 7. Verificar Permissões do Usuário

O usuário `B1ADMIN` precisa ter permissão para acessar o banco. Verifique:
- Se o usuário existe
- Se tem permissões de leitura no banco
- Se não está bloqueado ou desabilitado

## Próximos Passos

1. Execute o teste de conexão: `GET http://localhost:3001/api/test-connection`
2. Verifique os resultados e use a configuração que funcionar
3. Atualize `server/config/database.js` com a configuração correta
4. Reinicie o servidor: `npm run dev`

## Exemplo de Resposta do Teste

```json
{
  "success": true,
  "results": [
    {
      "name": "Configuração original",
      "success": false,
      "message": "Banco de dados não encontrado"
    },
    {
      "name": "Banco em minúsculas",
      "success": true,
      "message": "Conexão bem-sucedida"
    }
  ]
}
```

Use a configuração que retornar `"success": true`.
