-- Alta de la usuaria del estudio. Ejecutar en el SQL Editor de Supabase
-- DESPUÉS de crear la usuaria en Authentication → Users (email + contraseña).
-- Aida y Mer comparten este mismo acceso.
select public.add_studio_member('info@ykono.es', 'owner');
