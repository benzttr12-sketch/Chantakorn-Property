import { Inquiry, FollowUpTemplate } from '@/lib/types';
import { notifyCustomerFollowUp } from '@/lib/store/inquiry-line-notifications';

export interface AutomationTriggerContext {
  inquiry: Inquiry;
  template: FollowUpTemplate;
  actorName?: string;
  actorEmail?: string;
}

export interface AutomationExecutionResult {
  inquiry_id: string;
  template_id: string;
  template_name: string;
  channel: 'line' | 'email';
  status: 'sent' | 'failed';
  message: string;
  timestamp: string;
}

/**
 * คำนวณข้อความที่จะส่งให้ลูกค้าจาก Template อัตโนมัติ
 */
export function renderFollowUpMessage(template: FollowUpTemplate, inquiry: Inquiry): string {
  const propertyRef = inquiry.property_title ? `เรื่องทรัพย์ "${inquiry.property_title}"` : 'การสอบถามข้อมูลทรัพย์';
  let message = template.message
    .replace(/{{customer_name}}/g, inquiry.customer_name || 'ลูกค้า')
    .replace(/{{property_title}}/g, inquiry.property_title || 'ทรัพย์ที่สนใจ')
    .replace(/{{agent_name}}/g, 'คุณฉันทากร (เบนซ์)');

  if (!message.includes(propertyRef)) {
    message = `${message}\n\n(อ้างอิง: ${propertyRef})`;
  }
  return message;
}

/**
 * เอนจินหลักสำหรับยิง Follow Up ตาม Channel
 */
export async function executeFollowUpAutomation(ctx: AutomationTriggerContext): Promise<AutomationExecutionResult> {
  const { inquiry, template, actorName, actorEmail } = ctx;
  const timestamp = new Date().toISOString();

  if (template.channel === 'line') {
    const result = await notifyCustomerFollowUp({
      inquiry,
      template_id: template.id,
      template_name: template.name,
      custom_message: renderFollowUpMessage(template, inquiry),
      actor_name: actorName,
      actor_email: actorEmail,
    });
    return {
      inquiry_id: inquiry.id,
      template_id: template.id,
      template_name: template.name,
      channel: 'line',
      status: result.success ? 'sent' : 'failed',
      message: result.message,
      timestamp,
    };
  }

  // email channel
  return {
    inquiry_id: inquiry.id,
    template_id: template.id,
    template_name: template.name,
    channel: 'email',
    status: 'sent',
    message: `ระบบบันทึกอีเมลตามเทมเพลต "${template.name}" สำเร็จ (โหมดจำลองการส่ง ไม่มี SMTP server ตัวจริง)`,
    timestamp,
  };
}

export const DEFAULT_AUTOMATION_LINE_ID = '@930xzcyi';
