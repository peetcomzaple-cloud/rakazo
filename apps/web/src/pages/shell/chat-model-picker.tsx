import { Trans, useLingui } from "@lingui/react/macro";
import type { Bot, ModelCatalogEntry, ModelCredential } from "@rakazo/contracts";
import { connectedModelChoices, modelOptionKey, parseModelOptionKey } from "@rakazo/core";
import {
  Button,
  Input,
  NativeSelect,
  NativeSelectOption,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@rakazo/ui-web";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

/** Uses the same persisted bot model override as bot settings; no separate preference. */
export function ChatModelPicker({
  bot,
  onChange,
  onManageModels,
}: {
  bot: Bot;
  onChange: (patch: {
    modelProvider: string | null;
    modelId: string | null;
    thinkingLevel: null;
  }) => Promise<void>;
  onManageModels: () => void;
}) {
  const { t } = useLingui();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [credentials, setCredentials] = useState<ModelCredential[]>([]);
  const [catalog, setCatalog] = useState<ModelCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected =
    bot.modelProvider && bot.modelId ? modelOptionKey(bot.modelProvider, bot.modelId) : "";
  const options = useMemo(() => {
    // Keep saved custom IDs, while also offering catalog models for connected providers.
    const choices = [
      ...connectedModelChoices(credentials, catalog),
      ...connectedModelChoices(
        credentials.map((credential) => ({ ...credential, modelId: null })),
        catalog,
      ),
    ];
    return [...new Map(choices.map((choice) => [choice.key, choice])).values()].map((choice) => {
      const capability =
        catalog.find((entry) => entry.provider === choice.provider && entry.id === choice.modelId)
          ?.supportsImages ??
        credentials.find(
          (entry) => entry.provider === choice.provider && entry.modelId === choice.modelId,
        )?.supportsImages;
      const capabilityLabel =
        capability === true
          ? t`Images`
          : capability === false
            ? t`Text only`
            : t`Image support unknown`;
      return {
        ...choice,
        label: `${choice.label} · ${capabilityLabel}`,
        supportsImages: capability,
      };
    });
  }, [credentials, catalog, t]);
  const visibleOptions = options.filter((option) =>
    `${option.label} ${option.modelId}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const label = options.find((option) => option.key === selected)?.label ?? bot.modelId;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setQuery("");
    void Promise.all([rpc.models.credentials(), rpc.models.list()])
      .then(([nextCredentials, nextCatalog]) => {
        if (cancelled) return;
        setCredentials(nextCredentials);
        setCatalog(nextCatalog);
      })
      .catch((err) => {
        if (!cancelled) setError(errorText(err, t`Could not load models`));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, t]);

  async function choose(key: string) {
    if (saving || key === selected) return;
    setSaving(true);
    setError(null);
    try {
      const choice = key ? parseModelOptionKey(key) : null;
      await onChange({
        modelProvider: choice?.provider ?? null,
        modelId: choice?.modelId ?? null,
        thinkingLevel: null,
      });
      setOpen(false);
    } catch (err) {
      setError(errorText(err, t`Could not change model`));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={t`Choose model`}
            data-testid="chat-model-picker"
            className="app-no-drag max-w-36 gap-1 md:max-w-60"
          />
        }
      >
        <span className="truncate">{selected ? label : t`Automatic`}</span>
        <ChevronDown size={14} aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-3">
        <Input
          aria-label={t`Search models`}
          placeholder={t`Search models`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={loading || saving}
        />
        <label htmlFor={id} className="text-sm text-muted-foreground">
          <Trans>Model</Trans>
        </label>
        <NativeSelect
          id={id}
          value={selected}
          disabled={loading || saving || Boolean(error && !options.length)}
          onChange={(event) => void choose(event.target.value)}
        >
          <NativeSelectOption value="">{t`Automatic`}</NativeSelectOption>
          {selected && !visibleOptions.some((option) => option.key === selected) ? (
            <NativeSelectOption value={selected}>{label}</NativeSelectOption>
          ) : null}
          {visibleOptions.map((option) => (
            <NativeSelectOption key={option.key} value={option.key}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          <Trans>
            Automatic uses a cheaper model for reading and your account model for other tasks.
          </Trans>
        </p>
        {options.find((option) => option.key === selected)?.supportsImages === false ? (
          <p className="text-xs text-muted-foreground">
            <Trans>
              This model cannot see screenshots. Select an image-capable model for desktop control.
            </Trans>
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            onManageModels();
          }}
        >
          <Trans>Manage models</Trans>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
