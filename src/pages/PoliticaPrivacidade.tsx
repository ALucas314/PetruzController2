import { Shield } from "lucide-react";
import { DocumentPageLayout } from "@/components/DocumentPageLayout";

const PoliticaPrivacidade = () => {
  return (
    <DocumentPageLayout
      title="Política de Privacidade"
      subtitle="ERP Controller Petruz"
      updatedAt="março de 2026"
      icon={<Shield className="h-7 w-7 text-primary" />}
      backTo="/cadastro"
      backLabel="Voltar ao cadastro"
    >
      <h2>1. Introdução</h2>
      <p>
        Esta Política de Privacidade descreve como o ERP Controller Petruz (“nós”, “Plataforma”) coleta, usa,
        armazena e protege as informações dos usuários do sistema. Ao utilizar a Plataforma, você declara estar
        de acordo com as práticas aqui descritas.
      </p>

      <h2>2. Dados que coletamos</h2>
      <p>
        Podemos coletar: (a) dados de cadastro: nome, e-mail e senha (armazenada de forma criptografada);
        (b) dados de uso: registros de produção, linhas, itens, filiais e demais informações que você inserir
        no sistema; (c) dados técnicos: endereço IP, tipo de navegador e dados de acesso, quando necessário
        para operação e segurança da Plataforma.
      </p>

      <h2>3. Finalidade do tratamento</h2>
      <p>
        Os dados são utilizados para: prestar e melhorar o serviço; autenticar usuários; gerar relatórios e
        análises solicitados por você; cumprir obrigações legais; e garantir a segurança e a integridade da
        Plataforma. Não vendemos seus dados pessoais a terceiros.
      </p>

      <h2>4. Base legal e consentimento</h2>
      <p>
        O tratamento pode ter como base o consentimento (quando aplicável), a execução de contrato, o
        legítimo interesse ou o cumprimento de obrigação legal, nos termos da Lei Geral de Proteção de Dados (LGPD).
      </p>

      <h2>5. Compartilhamento de dados</h2>
      <p>
        Seus dados podem ser processados por prestadores de serviço que atuam em nosso nome (por exemplo,
        hospedagem e banco de dados), sob compromisso de confidencialidade. Também podemos divulgar dados
        quando exigido por lei ou autoridade competente.
      </p>

      <h2>6. Retenção e segurança</h2>
      <p>
        Mantemos os dados pelo tempo necessário para as finalidades descritas ou conforme exigido por lei.
        Adotamos medidas técnicas e organizacionais para proteger os dados contra acesso não autorizado,
        perda ou alteração indevida.
      </p>

      <h2>7. Seus direitos</h2>
      <p>
        Na forma da LGPD, você pode solicitar: acesso aos seus dados; correção de dados incompletos ou
        desatualizados; anonimização, bloqueio ou eliminação de dados desnecessários; portabilidade;
        revogação do consentimento, quando o tratamento tiver essa base. Para exercer esses direitos,
        entre em contato conosco pelos canais indicados na Plataforma.
      </p>

      <h2>8. Alterações</h2>
      <p>
        Esta Política de Privacidade pode ser atualizada. A data da última atualização será indicada no
        topo do documento. O uso continuado da Plataforma após alterações constitui aceitação da nova versão.
      </p>

      <h2>9. Contato</h2>
      <p>
        Para dúvidas ou pedidos relacionados a esta Política de Privacidade ou aos seus dados pessoais,
        utilize os canais de contato disponíveis na Plataforma ou no site oficial do ERP Controller Petruz.
      </p>
    </DocumentPageLayout>
  );
};

export default PoliticaPrivacidade;
