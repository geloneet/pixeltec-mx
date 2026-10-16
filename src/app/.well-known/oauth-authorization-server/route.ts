import {discovery} from '@/lib/mcp-secretary/runtime';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=()=>discovery('authorization');
