import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { DocumentPageLayout } from "@/components/DocumentPageLayout";

const TermosUso = () => {
  return (
    <DocumentPageLayout
      title="Termos de Uso"
      subtitle="ERP Controller Petruz"
      updatedAt="março de 2026"
      icon={<FileText className="h-7 w-7 text-primary" />}
      backTo="/cadastro"
      backLabel="Voltar ao cadastro"
    >
      <h2>1. Aceitação dos termos</h2>
      <p>
        Ao acessar ou utilizar o sistema ERP Controller Petruz (“Plataforma”), você concorda com estes Termos de Uso.
        Se não concordar, não utilize o serviço. O uso da Plataforma implica aceitação integral do presente documento.
      </p>

      <h2>2. Descrição do serviço</h2>
      <p>
        A Plataforma oferece ferramentas de gestão de produção, planejamento (PCP), análises, dashboards e relatórios,
        permitindo cadastro de linhas, itens, filiais e registro de dados de produção. O escopo e as funcionalidades
        podem ser alterados mediante aviso prévio quando aplicável.
      </p>

      <h2>3. Cadastro e conta</h2>
      <p>
        Para utilizar a Plataforma, o usuário deve se cadastrar fornecendo dados verdadeiros e atualizados.
        É de sua responsabilidade manter a confidencialidade da senha e das atividades realizadas em sua conta.
        A Plataforma reserva-se o direito de suspender ou encerrar contas em caso de violação destes termos ou uso indevido.
      </p>

      <h2>4. Uso permitido</h2>
      <p>
        O usuário compromete-se a utilizar a Plataforma apenas para fins legítimos, relacionados à gestão de produção
        e atividades empresariais. É vedado: (a) usar o sistema para fins ilícitos ou que infrinjam direitos de terceiros;
        (b) tentar acessar áreas restritas ou dados de outros usuários sem autorização; (c) interferir no funcionamento
        técnico da Plataforma; (d) redistribuir ou revender o acesso sem autorização expressa.
      </p>

      <h2>5. Propriedade intelectual</h2>
      <p>
        O software, marcas, textos e demais materiais da Plataforma são de propriedade do ERP Controller Petruz ou de
        seus licenciadores. O uso não concede ao usuário qualquer direito de propriedade sobre a Plataforma,
        exceto o direito de uso nos termos aqui estabelecidos.
      </p>

      <h2>6. Dados e responsabilidade</h2>
      <p>
        O usuário é responsável pela veracidade e legalidade dos dados que inserir na Plataforma. O tratamento de
        dados pessoais está descrito na Política de Privacidade. A Plataforma não se responsabiliza por decisões
        tomadas com base nos relatórios ou análises gerados, cabendo ao usuário a validação dos dados e resultados.
      </p>

      <h2>7. Disponibilidade e alterações</h2>
      <p>
        A Plataforma é oferecida “como está”, podendo sofrer interrupções para manutenção. Nos limites da lei,
        não há garantia de disponibilidade ininterrupta. Os Termos de Uso podem ser atualizados; o uso continuado
        após alterações constitui aceitação da nova versão.
      </p>

      <h2>8. Lei aplicável e foro</h2>
      <p>
        Estes termos são regidos pelas leis da República Federativa do Brasil. Eventuais disputas serão submetidas
        ao foro da comarca do domicílio do usuário ou, a critério do ERP Controller Petruz, ao foro da comarca de sua sede.
      </p>

      <h2>9. Contato</h2>
      <p>
        Dúvidas sobre estes Termos de Uso podem ser encaminhadas através dos canais de contato disponibilizados
        na Plataforma ou no site oficial do ERP Controller Petruz.
      </p>
    </DocumentPageLayout>
  );
};

export default TermosUso;
