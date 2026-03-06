# 📜 Scripts SQL

Esta pasta contém scripts SQL para criação e manutenção do banco de dados.

## 📄 Scripts Disponíveis

### **SUPABASE_PRODUCAO_TABLE.sql**
Script completo para criar a tabela `producao` no Supabase com:
- Estrutura completa da tabela
- Índices para performance
- Triggers automáticos
- Comentários de documentação

## 🚀 Como Usar

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Copie e cole o conteúdo do script
4. Execute o script

## 📝 Notas

- Todos os scripts são idempotentes (podem ser executados múltiplas vezes)
- Use `IF NOT EXISTS` para evitar erros de duplicação
- Sempre faça backup antes de executar scripts em produção
