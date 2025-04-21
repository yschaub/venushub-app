
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const username = Deno.env.get('BASIC_AUTH_USERNAME');
const password = Deno.env.get('BASIC_AUTH_PASSWORD');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Encodes 'username:password' as base64
function encodeBasicAuth(user: string, pass: string) {
  return btoa(`${user}:${pass}`);
}

// Decodes 'Basic base64' header
function parseBasicAuth(auth: string) {
  if (!auth || !auth.startsWith('Basic ')) return null;
  const encoded = auth.replace(/^Basic\s/, '');
  try {
    const [u, p] = atob(encoded).split(':');
    return { user: u, pass: p };
  } catch {
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only protect dashboard and admin routes.
  const url = new URL(req.url);
  if (url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/admin')) {
    const auth = req.headers.get('authorization') || '';
    const parsed = parseBasicAuth(auth);
    if (!parsed || parsed.user !== username || parsed.pass !== password) {
      return new Response('Unauthorized', {
        status: 401,
        headers: {
          ...corsHeaders,
          'WWW-Authenticate': 'Basic realm="VenusHub", charset="UTF-8"'
        }
      });
    }
  }

  // Allow the request to continue.
  return new Response('OK', { status: 200, headers: corsHeaders });
});
