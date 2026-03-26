import { hash } from 'node:crypto';

import { Action, ActionPanel, List } from '@vicinae/api';
import { useState } from 'react';

type HashFunctionProps = {
  title: string;
  value: string;
  hash: (text: string) => string;
};

function HashFunction(props: HashFunctionProps) {
  const hashValue = props.hash(props.value);

  return (
    <List.Item
      title={props.title}
      subtitle={hashValue}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard content={hashValue} />
        </ActionPanel>
      }
    />
  );
}

const algorithms = [
  { name: 'MD5', id: 'md5' },
  { name: 'SHA256', id: 'sha256' },
  { name: 'SHA512', id: 'sha512' },
  { name: 'SHA1', id: 'sha1' },
] as const;

export default function Hash() {
  let [searchText, setSearchText] = useState('');

  return (
    <List
      searchBarPlaceholder='Enter text to hash...'
      onSearchTextChange={(text) => setSearchText(text)}
    >
      {algorithms.map((algorithm) => (
        <HashFunction
          title={algorithm.name}
          value={searchText}
          hash={(text) => hash(algorithm.id, text)}
        />
      ))}
    </List>
  );
}
