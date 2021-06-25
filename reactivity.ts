import { observable, observe, unobserve } from '@nx-js/observer-util'
import { FunctionalComponent, options } from 'preact'
import { Inputs, useEffect, useLayoutEffect, useMemo, useState } from 'preact/hooks'

/**
 * Позволяет отслеживать реактивные зависимости компонента
 * @param component Функциональный компонент Preact
 * @return Переданный компонент в реактивной обёртке
 */
export function reactiveComponent<P>(component: FunctionalComponent<P>): FunctionalComponent<P> {
  let name = component.displayName || component.name
  let result: { [key: string]: FunctionalComponent<P> } = {
    [name]: (props: P) => {
      // Используем useState для получения возможности обновления компонента
      const [, requestRerender] = useState({})
      // create a memoized reactive wrapper of the original component
      // at the very first run of the component function
      const render = useMemo(
        () =>
          observe(component, {
            // React (и Preact тоже) неплохо умеет склеивать setState
            // Поэтому его можно спокойно вызвать хоть миллион раз(буквально)
            scheduler: () => requestRerender({}),
            lazy: true,
          }),
        // В оригинальной либе для React написано, что так надо, чтобы девтулзы не ломались
        [component]
      )

      // После анмаунта компонента очищаем зависимость
      useEffect(() => {
        return () => unobserve(render)
      }, [])

      return render(props)
    },
  }

  result[name].displayName = name
  return result[name]
}

//Используем option hooks для навешивания на компоненты преакта реактивности
let oldVnode = options.vnode
const cache = new WeakMap()
window['componentCache'] = cache
options.vnode = (vnode) => {
  if (typeof vnode.type == 'function') {
    if (!cache.has(vnode.type)) cache.set(vnode.type, reactiveComponent(vnode.type as FunctionalComponent))
    vnode.type = cache.get(vnode.type)
  }
  if (oldVnode) oldVnode(vnode)
}

/**
 * Аналог useState. Создаёт реактивное состояние, привязанное к текущему объекту
 * @param initialState Изначальное состояние или функция, которая его создает
 * @return Возвращает реактивную версию состояния, при изменении этого состояния, возвращает измененную версию
 */

export function useReactiveState<T extends Object>(initialState: T | (() => T)): T {
  let [state] = useState(() => {
    if (typeof initialState == 'function') initialState = (initialState as Function)()
    //initialState может быть очищен GC при удалении компонента
    return observable(initialState as T)
  })
  return state
}

export function useReactiveLayoutEffect(callback: () => void, inputs?: Inputs) {
  const [, requestRerender] = useState({})
  const reactiveCallback = useMemo(
    () =>
      observe(callback, {
        scheduler: () => requestRerender({}),
        lazy: true,
      }),
    // В оригинальной либе для React написано, что так надо, чтобы девтулзы не ломались
    [callback]
  )
  useLayoutEffect(reactiveCallback, inputs)
}

/**
 * Делает объект реактивным. Использовать вне компонентов preact
 * @param object Изначальное состояние
 * @return Возвращает реактивную версию состояния
 */
export function reactive<T extends Object>(object: T): T {
  return observable(object)
}
