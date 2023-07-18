import { Profiles, RequestHeader } from './entities/request-profile/types';
import { BrowserStorageKey, ServiceWorkerEvent } from './shared/constants';

function getRule(header: RequestHeader) {
  const allResourceTypes = Object.values(chrome.declarativeNetRequest.ResourceType);

  return {
    id: header.id,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      requestHeaders: [
        { header: header.name, value: header.value, operation: chrome.declarativeNetRequest.HeaderOperation.SET },
      ],
    },
    condition: {
      urlFilter: undefined,
      resourceTypes: allResourceTypes,
    },
  };
}

function notify(message: ServiceWorkerEvent) {
  if (message === ServiceWorkerEvent.Reload) {
    chrome.storage.local.get(
      [BrowserStorageKey.Profiles, BrowserStorageKey.SelectedProfile, BrowserStorageKey.IsPaused],
      async result => {
        const isPaused: boolean = result[BrowserStorageKey.IsPaused];
        const profiles: Profiles = new Map(Object.entries(JSON.parse(result[BrowserStorageKey.Profiles])));
        const selectedProfile: string = result[BrowserStorageKey.SelectedProfile];
        const currentRules = await chrome.declarativeNetRequest.getDynamicRules();

        const selectedProfileHeaders = profiles.get(selectedProfile) ?? [];

        const addRules = !isPaused
          ? selectedProfileHeaders
              .filter(({ disabled, name, value }) => !disabled && Boolean(name) && Boolean(value))
              .map(getRule)
          : [];
        const removeRuleIds = currentRules.map(item => item.id);

        try {
          await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds,
            addRules,
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.log(err);
        }
      },
    );
  }
}

chrome.storage.local.get(
  [BrowserStorageKey.Profiles, BrowserStorageKey.SelectedProfile, BrowserStorageKey.IsPaused],
  result => Object.keys(result).length && notify(ServiceWorkerEvent.Reload),
);

chrome.runtime.onMessage.addListener(notify);