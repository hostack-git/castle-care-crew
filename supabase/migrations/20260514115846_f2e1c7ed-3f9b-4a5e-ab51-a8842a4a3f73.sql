
-- Reset password for jorge.ibanez.ciej@gmail.com to a known value
UPDATE auth.users
SET encrypted_password = crypt('Torridon2026!', gen_salt('bf')),
    updated_at = now()
WHERE email = 'jorge.ibanez.ciej@gmail.com';

-- Grant admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'jorge.ibanez.ciej@gmail.com'
ON CONFLICT DO NOTHING;
