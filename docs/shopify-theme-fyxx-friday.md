# myfyxx.com theme snippet: count website orders after a Fyxx Friday visit

The Friday site (friday.myfyxx.com) leaves a first-party cookie `fyxx_friday`
on `.myfyxx.com` (30 days): the visit session, where the visitor first came
from, and when. This snippet in the **myfyxx.com** Shopify theme copies it onto
the shopper's cart as hidden cart attributes. Shopify carries cart attributes
onto the order, and `/admin` on the Friday site then counts these orders under
"After the Friday site". Attributes that start with `_` are not shown to the
shopper at checkout.

Safe: read only on the cookie, one small `/cart.js` call per page only for
visitors who have the cookie, never changes items or prices, fails silently.

## Install (2 minutes)

1. Shopify admin -> Online Store -> Themes -> live theme -> `...` -> Edit code.
2. Open `layout/theme.liquid`.
3. Paste the snippet below just before `</body>`. Save.
4. Test: open friday.myfyxx.com on your phone, then www.myfyxx.com, add
   something to the cart, and open `https://www.myfyxx.com/cart.js`: the
   `attributes` should include `_bf_visit`.

```html
<!-- Fyxx Friday: tag carts of shoppers who visited friday.myfyxx.com (see the Friday site repo docs) -->
<script>
(function () {
  try {
    var m = document.cookie.match(/(?:^|;\s*)fyxx_friday=([^;]+)/);
    if (!m) return;
    var v = JSON.parse(decodeURIComponent(m[1]));
    if (!v || !v.sid) return;
    fetch('/cart.js', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        var a = (cart && cart.attributes) || {};
        if (a._bf_visit === v.sid) return; // already tagged
        return fetch('/cart/update.js', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attributes: {
            _bf_visit: v.sid,
            _bf_visit_source: v.src || '',
            _bf_visit_medium: v.med || '',
            _bf_visit_campaign: v.camp || '',
            _bf_visit_first: v.first || ''
          } })
        });
      })
      .catch(function () {});
  } catch (e) {}
})();
</script>
```

Remove it after the campaign (the cookie expires 30 days after the last visit).

Not covered: the Fyxx app (it doesn't share the browser's cookies) and
"Buy it now" buttons that skip the cart.
