f = 'src/components/FriendsView.tsx'
content = open(f, 'r', encoding='utf-8').read()

marker = '  async function fetchP2PGam3eya() {'
func_code = (
    '  async function loadUnifiedItems(cat: "installment" | "gam3eya") {\n'
    '    if (!chatFriend || !uid) return;\n'
    '    if (cat === "installment") {\n'
    '      const sb = getSupabase();\n'
    '      if (!sb) return;\n'
    '      const { data } = await sb.from("debt_requests")\n'
    '        .select("id, amount, description, is_installment, total_installments, installment_amount, paid_installments, status")\n'
    '        .eq("is_installment", true)\n'
    '        .eq("status", "confirmed")\n'
    '        .or("and(creditor.eq." + uid + ",debtor.eq." + chatFriend.friend_id + "),and(creditor.eq." + chatFriend.friend_id + ",debtor.eq." + uid + ")");\n'
    '      const unpaid = ((data || []) as any[]).filter((d: any) => (d.paid_installments || 0) < (d.total_installments || 0));\n'
    '      setP2pItems(unpaid);\n'
    '    } else {\n'
    '      if (chatFriend.gam3eya_total && chatFriend.gam3eya_amount) {\n'
    '        setP2pItems([{\n'
    '          id: "gam3eya",\n'
    '          amount: chatFriend.gam3eya_amount,\n'
    '          total: chatFriend.gam3eya_total,\n'
    '          completed: chatFriend.gam3eya_completed || 0,\n'
    '        }]);\n'
    '      } else {\n'
    '        setP2pItems([]);\n'
    '      }\n'
    '    }\n'
    '  }\n\n'
    '  '
)
if marker in content:
    content = content.replace(marker, func_code + marker, 1)
    print('func added')
else:
    print('marker not found')

old_i = 'onClick={() => setUnifiedCat("installment")}'
new_i = 'onClick={() => { setUnifiedCat("installment"); loadUnifiedItems("installment"); }}'
if old_i in content:
    content = content.replace(old_i, new_i, 1)
    print('inst wired')
else:
    print('inst not found')

old_g = 'onClick={() => setUnifiedCat("gam3eya")}'
new_g = 'onClick={() => { setUnifiedCat("gam3eya"); loadUnifiedItems("gam3eya"); }}'
if old_g in content:
    content = content.replace(old_g, new_g, 1)
    print('gam wired')
else:
    print('gam not found')

open(f, 'w', encoding='utf-8').write(content)
print('done')
