# CSRF Token — Guia de Implementação

## O que é CSRF?

CSRF (Cross-Site Request Forgery) é um ataque onde um site malicioso força seu navegador a fazer requisições indesejadas para outro site onde você está autenticado.

**Exemplo:** Um site malicioso executa `fetch('https://siga.lacen/api/auth/login/')` no seu navegador sem você saber.

## Como o SIGA-LACEN protege contra CSRF

O Django usa **tokens CSRF** para validar que requisições POST vêm de **formulários legítimos** do seu próprio site.

### Fluxo:

1. **Backend renderiza token no HTML:**
   ```html
   <div data-csrf="{{ csrf_token }}">...</div>
   ```

2. **Frontend extrai o token:**
   ```javascript
   const token = document.querySelector('[data-csrf]').dataset.csrf;
   ```

3. **Frontend envia no header `X-CSRFToken`:**
   ```javascript
   fetch('/api/auth/login/', {
     headers: { 'X-CSRFToken': token },
     body: JSON.stringify({...})
   })
   ```

4. **Django valida o token:**
   - Middleware `CsrfViewMiddleware` verifica se o token no header corresponde ao da sessão
   - Se não corresponder → **403 Forbidden**

## Quando ocorrem erros 403?

| Situação | Causa | Solução |
|----------|-------|--------|
| `data-csrf` está vazio | Template não renderizou `{{ csrf_token }}` | Verificar `django.middleware.csrf.context_processors.csrf` em `TEMPLATES['OPTIONS']['context_processors']` |
| Elemento `#login-app` não tem `data-csrf` | Template renderiza mas JavaScript não extrai | Verificar se `document.getElementById('login-app')` existe e tem atributo `data-csrf` |
| Token expirou | Sessão Django expirou entre renderizar página e enviar POST | Usuário recarrega página e tenta novamente |
| CORS + CSRF conflitam | Header `X-CSRFToken` não é enviado por CORS | Adicionar `X-CSRFToken` à lista de `CORS_ALLOW_HEADERS` |

## Implementação no SIGA-LACEN

### Backend (`backend/templates/usuarios/login.html`)

```html
<div 
  id="login-app" 
  data-csrf="{{ csrf_token }}"           <!-- ← Django renderiza aqui -->
  data-next="{{ request.GET.next|default:'/' }}"
></div>
```

**Checklist:**
- ✅ Template usa `{% csrf_token %}` ou renderiza `{{ csrf_token }}`
- ✅ Middleware `CsrfViewMiddleware` está ativo em `MIDDLEWARE`
- ✅ View não tem `@csrf_exempt` (a menos que seja intencional)

### Frontend (`frontend/src/entries/login.jsx`)

```javascript
function getCsrfToken() {
  const el = document.getElementById("login-app");
  let token = el?.dataset.csrf;
  
  // Fallback: extrair do cookie se data attribute não existir
  if (!token) {
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    token = match ? match[1] : null;
  }
  
  return token || "";
}
```

**Checklist:**
- ✅ Extrai do `data-csrf` (via `el.dataset.csrf`)
- ✅ Fallback para cookie `csrftoken` se não encontrar
- ✅ Retorna string vazia (`""`) se não encontrar nada (Django ignora header vazio)

### Frontend (`frontend/src/pages/Login.jsx`)

```javascript
const res = await fetch("/api/auth/login/", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken": csrf || ""  // ← Sempre enviar o header
  },
  body: JSON.stringify({ email, senha })
});

// Tratar erro 403 como erro CSRF
if (res.status === 403) {
  console.error("Possível erro de CSRF token. Recarregue a página.");
  setErro("Erro de segurança. Recarregue a página e tente novamente.");
}
```

**Checklist:**
- ✅ Header `X-CSRFToken` é sempre enviado (mesmo que vazio)
- ✅ Errors 403 são tratados como avisos de CSRF
- ✅ Usuário recebe mensagem clara se algo der errado

## Debugging

### Se receber 403 Forbidden:

**1. Verificar se o token chegou ao frontend:**
```javascript
const el = document.getElementById("login-app");
console.log("CSRF Token:", el.dataset.csrf);
```

**2. Verificar se o header está sendo enviado:**
```javascript
// No DevTools (F12), aba Network → selecionar POST /api/auth/login/
// Headers → procurar por "X-CSRFToken"
```

**3. Verificar se o Django está renderizando o token:**
```python
# No Django shell
python manage.py shell
>>> from django.middleware.csrf import get_token
>>> from django.test import RequestFactory
>>> factory = RequestFactory()
>>> request = factory.get('/login/')
>>> token = get_token(request)
>>> print(token)  # Deve retornar uma string de 32+ caracteres
```

**4. Se ainda não funcionar:**
- Recarregue a página (obtém novo token)
- Limpe cookies do navegador (Settings → Clear Cookies)
- Verifique se há outro `@csrf_exempt` conflitando

## Resumo das Melhorias Implementadas

✅ **Validação + Fallback** — CSRF extraído de `data-csrf` com fallback para cookie  
✅ **Tratamento de erro 403** — Identifica como erro CSRF e dá mensagem clara  
✅ **Documentação** — Comentários no HTML e JS explicam por que é importante  
✅ **Logging de debug** — Aviso se token não for encontrado em dev mode  

Isso previne futuros erros 403 ao fazer login.
