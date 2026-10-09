
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 2,
    "route": "/"
  },
  {
    "renderMode": 2,
    "route": "/inicio"
  },
  {
    "renderMode": 0,
    "route": "/foro/*"
  },
  {
    "renderMode": 0,
    "route": "/foro/*/post/*"
  },
  {
    "renderMode": 0,
    "route": "/juego/*"
  },
  {
    "renderMode": 0,
    "route": "/voz/*"
  },
  {
    "renderMode": 2,
    "route": "/login"
  },
  {
    "renderMode": 2,
    "route": "/register"
  },
  {
    "renderMode": 2,
    "route": "/admin"
  },
  {
    "renderMode": 2,
    "route": "/help"
  },
  {
    "renderMode": 2,
    "route": "/rules"
  },
  {
    "renderMode": 2,
    "route": "/qa"
  },
  {
    "renderMode": 2,
    "route": "/perfil"
  },
  {
    "renderMode": 2,
    "redirectTo": "/",
    "route": "/**"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 7935, hash: '4ef78a0ac71abac188c6cfcb6907f6cb275837c682f7ef5c40ffb15cf5bd68b0', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 1156, hash: '951983327b5a6eaabe3a9ae7ac79d8268d0ba394ff9bcf8ec43bc598632338fd', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'login/index.html': {size: 13407, hash: '6bb24cdf1df5d26c4e8ea3cfd5cd94ca22cdf408dd9b4431a8e61a633eee694f', text: () => import('./assets-chunks/login_index_html.mjs').then(m => m.default)},
    'index.html': {size: 17743, hash: 'e5c210cad7bfd734c4a93def46b9df935a0826fbd8093d9cc66fafb417251c89', text: () => import('./assets-chunks/index_html.mjs').then(m => m.default)},
    'register/index.html': {size: 13369, hash: 'd9689461655d62d06fb63c933b0ae5f94d9e4843fec7ff8f4424677fa5f5af98', text: () => import('./assets-chunks/register_index_html.mjs').then(m => m.default)},
    'inicio/index.html': {size: 24607, hash: '77e226f780de4a97398c2ee62445257d5d35b9dddf4c20982fc7cdf225e9b7db', text: () => import('./assets-chunks/inicio_index_html.mjs').then(m => m.default)},
    'help/index.html': {size: 25647, hash: '466accc25ea9b0f9e659b3430b06dfa26e6e58d9afe7e21b29dac6c0f636bc3c', text: () => import('./assets-chunks/help_index_html.mjs').then(m => m.default)},
    'admin/index.html': {size: 23919, hash: 'df1e1cf3828888980cf2cd722dfa09d724e05d2d230cdf5a643cc54902241aaf', text: () => import('./assets-chunks/admin_index_html.mjs').then(m => m.default)},
    'qa/index.html': {size: 27832, hash: '90d2f0c8e3779a1a0579924fef0ad89a264d857418f0d7a541ff3b0a7260db61', text: () => import('./assets-chunks/qa_index_html.mjs').then(m => m.default)},
    'rules/index.html': {size: 26294, hash: '1bb5c48eff3909982e31f0bab5904cfb5055218e506fa7b5448164d053cc1e08', text: () => import('./assets-chunks/rules_index_html.mjs').then(m => m.default)},
    'perfil/index.html': {size: 27308, hash: '73cb8931da4efda0f9574caa88eb738555d432e348f0c7e2823d71ab8a0e0f10', text: () => import('./assets-chunks/perfil_index_html.mjs').then(m => m.default)},
    'styles-CQYAKUC2.css': {size: 38298, hash: 'WhdBuckN30Q', text: () => import('./assets-chunks/styles-CQYAKUC2_css.mjs').then(m => m.default)}
  },
};
