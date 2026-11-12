import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const reminderDays = [30, 14, 7, 0];

Deno.serve(async () => {
  const today = new Date();
  const earliest = new Date(today);
  earliest.setDate(today.getDate() + 30);
  const { data: records, error } = await supabase
    .from('compliance_records')
    .select('id, vehicle_id, compliance_type, expiry_date')
    .lte('expiry_date', earliest.toISOString().slice(0, 10))
    .gte('expiry_date', today.toISOString().slice(0, 10));

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let created = 0;
  for (const record of records ?? []) {
    const expiry = new Date(`${record.expiry_date}T00:00:00Z`);
    const daysRemaining = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
    const stage = reminderDays.find((days) => daysRemaining <= days) ?? 0;
    const reminderDate = today.toISOString().slice(0, 10);
    const { error: insertError } = await supabase.from('reminder_logs').insert({
      vehicle_id: record.vehicle_id,
      related_record_id: record.id,
      reminder_type: record.compliance_type,
      reminder_date: reminderDate,
      channel: `in_app_${stage}`,
    });

    if (!insertError) {
      await supabase.from('notifications').insert({
        vehicle_id: record.vehicle_id,
        notification_type: 'compliance_expiry',
        title: `${record.compliance_type} renewal`,
        message: `${record.compliance_type} expires in ${Math.max(daysRemaining, 0)} days.`,
        due_date: record.expiry_date,
      });
      created += 1;
    }
  }

  return new Response(JSON.stringify({ processed: records?.length ?? 0, created }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
