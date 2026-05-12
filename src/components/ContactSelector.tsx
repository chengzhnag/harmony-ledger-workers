import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, UserPlus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Contact } from "@shared/types";
interface ContactSelectorProps {
  value?: string;
  onSelect: (contact: { id?: string; name: string }) => void;
}
export function ContactSelector({ value, onSelect }: ContactSelectorProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchContacts = async (query: string) => {
    if (!user?.activeFamilyId) return;
    setLoading(true);
    try {
      const data = await api<Contact[]>(`/api/contacts/search?familyId=${user.activeFamilyId}&q=${query}`);
      setContacts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.activeFamilyId) return;
    const timer = setTimeout(() => fetchContacts(search), 300);
    return () => clearTimeout(timer);
  }, [user?.activeFamilyId, search]);

  const selectedContact = contacts.find((c) => c.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-12 bg-slate-50 border-none rounded-xl text-left font-normal"
        >
          {value || t('form.personPlaceholder')}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 rounded-2xl border-none shadow-soft overflow-hidden" align="start" onOpenAutoFocus={(e) => e.preventDefault()} >
        <Command shouldFilter={false} autoFocus={false}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
            <CommandInput
              placeholder={t('contacts.search')}
              value={search}
              onValueChange={setSearch}
              className="border-none focus:ring-0 pl-8"
              autoFocus={false}
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-rose-500"></div>
              </div>
            )}
          </div>
          <CommandList className="max-h-[300px] overflow-y-auto overscroll-contain">
            <CommandEmpty className="p-4 text-center">
              {loading ? (
                <p className="text-sm text-slate-500">{t('common.loading')}</p>
              ) : (
                <>
                  <p className="text-sm text-slate-500 mb-2">{t('contacts.noContacts')}</p>
                  {search && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                      onClick={async () => {
                        try {
                          const newName = search;
                          const res = await api<{ id: string }>('/api/contacts', {
                            method: 'POST',
                            body: JSON.stringify({
                              familyId: user?.activeFamilyId,
                              name: newName,
                              remarks: ''
                            })
                          });
                          toast.success(t('contacts.addSuccess'));
                          await fetchContacts(search);
                          onSelect({ id: res.id, name: newName });
                          setOpen(false);
                        } catch (err: any) {
                          toast.error(err.message || t('common.error'));
                        }
                      }}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      {t('contacts.add')} "{search}"
                    </Button>
                  )}
                </>
              )}
            </CommandEmpty>
            <CommandGroup>
              {contacts.map((contact) => (
                <CommandItem
                  key={contact.id}
                  value={contact.name}
                  onSelect={() => {
                    onSelect({ id: contact.id, name: contact.name });
                    setOpen(false);
                  }}
                  className="py-3 px-4 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800">{contact.name}</span>
                    {contact.remarks && <span className="text-[10px] text-slate-400">{contact.remarks}</span>}
                  </div>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === contact.name ? "opacity-100 text-rose-500" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}