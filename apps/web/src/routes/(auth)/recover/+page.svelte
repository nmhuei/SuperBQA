<script lang="ts">
  import { ProtectedAction, RecoverRouteV2 } from '@rctf/types'
  import { page } from '$app/state'
  import ArchivedNotice from '$lib/components/archived-notice.svelte'
  import CaptchaNotice from '$lib/components/captcha-notice.svelte'
  import { useApiForm } from '$lib/forms/use-api-form.svelte'
  import { useClientConfig } from '$lib/query/config'
  import { toast } from '$lib/toast'
  import Button from '$lib/ui/button.svelte'
  import Card from '$lib/ui/card.svelte'
  import Field from '$lib/ui/field.svelte'
  import Input from '$lib/ui/input.svelte'
  import Spinner from '$lib/ui/spinner.svelte'
  import {
    getAuthPageHref,
    getAuthReturnPath,
    rememberAuthReturn,
  } from '$lib/utils/redirect'

  const configQuery = useClientConfig()
  const clientConfig = $derived(configQuery.data)
  const returnPath = $derived(
    getAuthReturnPath(page.url.searchParams.get('next'), page.url.origin)
  )

  let verifySent = $state(false)

  const form = useApiForm(RecoverRouteV2, {
    onSuccess: () => {
      rememberAuthReturn(returnPath, page.url.origin)
      verifySent = true
      toast.success('Recovery email sent!')
    },
  })
</script>

<svelte:head>
  {#if clientConfig}
    <title>Recover account | {clientConfig.ctfName}</title>
  {/if}
</svelte:head>

{#if clientConfig?.isArchived}
  <ArchivedNotice message="Account recovery is not available." />
{:else if verifySent}
  <Card
    title="Recovery email sent"
    description="Get a new team token sent to your email"
  >
    <auth-page>
      <p>
        If an account exists for <strong>{form.data.email}</strong>, we've sent
        a recovery email. Please check your inbox and click the link to access
        your account. If you didn't receive the email, check your spam folder or
        <button type="button" onclick={() => (verifySent = false)}
          >try again</button
        >.
      </p>
      <footer-note
        ><a href={getAuthPageHref('/login', returnPath, page.url.origin)}
          >Back to login</a
        >.</footer-note
      >
    </auth-page>
  </Card>
{:else}
  <Card
    title="Recover account"
    description="Get a new team token sent to your email"
  >
    <auth-page>
      <form onsubmit={form.submit}>
        <Field label="Email" error={form.errors.email ?? form.errors._form}>
          {#snippet children({ id, describedBy })}
            <Input
              {id}
              name="email"
              type="email"
              placeholder="Enter your email"
              autocomplete="email"
              required
              aria-describedby={describedBy}
              aria-invalid={!!form.errors.email ||
                !!form.errors._form ||
                undefined}
              bind:value={form.data.email}
            />
          {/snippet}
        </Field>
        <Button type="submit" disabled={form.submitting}>
          {#if form.submitting}
            <Spinner />
          {/if}
          Recover
        </Button>
      </form>
      <footer-note
        >Remember your token? <a
          href={getAuthPageHref('/login', returnPath, page.url.origin)}
          >Login here</a
        >.</footer-note
      >
      <CaptchaNotice config={clientConfig} action={ProtectedAction.Recover} />
    </auth-page>
  </Card>
{/if}
