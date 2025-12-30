# Built for Shopify Certification Tracker

**Goal**: Achieve Built for Shopify status for Returns Hub

---

## Technical Criteria Checklist

### Performance (Core Web Vitals)

| Requirement | Target | Status | Notes |
|-------------|--------|--------|-------|
| Largest Contentful Paint (LCP) | < 2.5s | ⏳ Pending | Measure with 100+ admin calls |
| Cumulative Layout Shift (CLS) | < 0.1 | ⏳ Pending | |
| Interaction to Next Paint (INP) | < 200ms | ⏳ Pending | |
| Storefront loading impact | Minimal | ⏳ Pending | Theme extension performance |

### Design and Functionality

| Requirement | Status | Notes |
|-------------|--------|-------|
| Embedded in Shopify admin | ✅ Done | App uses `isEmbeddedApp: true` |
| Session token authentication | ✅ Done | Using `@shopify/shopify-app-remix` |
| Latest App Bridge version | ⏳ Check | Verify App Bridge version |
| Theme app extensions | ✅ Done | `extensions/return-portal/` exists |
| Clean uninstall | ⏳ Pending | Verify no leftover assets |
| Shopify design guidelines | ✅ Done | Using Polaris components |
| No Asset API usage | ✅ Done | Not using Asset API |

### Category-Specific: Returns and Exchanges

| Requirement | Status | Notes |
|-------------|--------|-------|
| Core returns functionality | ✅ Done | Return requests, approvals, routing |
| Exchange flow | ✅ Done | Shop Now exchange implemented |
| Store credit | ✅ Done | Gift card integration |
| Shipping labels | ✅ Done | Shippo/EasyPost integration |
| Customer notifications | ✅ Done | Email notifications |
| Analytics/reporting | ✅ Done | Analytics dashboard |

### Business Metrics (Post-Launch)

| Requirement | Target | Current | Status |
|-------------|--------|---------|--------|
| Net installs | 50+ | 0 | ⏳ Pre-launch |
| Reviews | 5+ | 0 | ⏳ Pre-launch |
| Star rating | 4+ | N/A | ⏳ Pre-launch |

---

## Action Items

### High Priority (Before Submission)

1. **Verify App Bridge Version**
   - Check `package.json` for `@shopify/app-bridge-react` version
   - Ensure using v4+ for performance features
   - File: `package.json`

2. **Performance Audit**
   - Run Lighthouse on embedded admin pages
   - Test with Chrome DevTools Performance tab
   - Measure LCP, CLS, INP
   - Optimize any violations

3. **Clean Uninstall Verification**
   - Test app uninstall flow
   - Verify webhook handler removes all data
   - Ensure theme extension cleans up properly
   - File: `app/routes/webhooks.app.uninstalled.tsx`

4. **Theme Extension Fixes**
   - Fix Liquid syntax errors in `return-portal.liquid`
   - Fix JSON schema in `en.default.json`
   - Add width/height to img tags

### Medium Priority

5. **Accessibility Audit**
   - Ensure all interactive elements are keyboard accessible
   - Verify ARIA labels on components
   - Test with screen reader

6. **Error Handling**
   - Ensure graceful degradation
   - User-friendly error messages
   - No console errors in production

### Post-Launch

7. **Gather Reviews**
   - Implement in-app review prompts (after positive interactions)
   - Follow up with early adopters

8. **Monitor Performance**
   - Set up performance monitoring
   - Track Core Web Vitals in production

---

## Resources

- [Built for Shopify Requirements](https://shopify.dev/docs/apps/launch/built-for-shopify)
- [Core Web Vitals Guide](https://web.dev/vitals/)
- [Shopify App Design Guidelines](https://shopify.dev/docs/apps/design-guidelines)
- [Theme App Extensions](https://shopify.dev/docs/apps/online-store/theme-app-extensions)
- [App Bridge Documentation](https://shopify.dev/docs/api/app-bridge)

---

## Submission Checklist

- [ ] All technical criteria met
- [ ] Performance benchmarks passed
- [ ] Theme extension errors fixed
- [ ] Clean uninstall verified
- [ ] App listing complete (description, screenshots, etc.)
- [ ] Privacy policy URL set
- [ ] Support contact configured
- [ ] 50+ net installs achieved
- [ ] 5+ reviews with 4+ star average
